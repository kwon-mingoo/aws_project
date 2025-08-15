#!/usr/bin/env python3
import sys
import json
import traceback
from datetime import datetime

# 기존 챗봇 모듈 import
try:
    from chatbot import (
        decide_route, 
        retrieve_documents_from_s3, 
        build_prompt, 
        build_general_prompt,
        generate_answer_with_nova,

        show_last_detail_if_any,
        expand_followup_query_with_last_window,
        save_turn_to_s3,
        SESSION_ID,
        TURN_ID,
        HISTORY,
        ENABLE_CHATLOG_SAVE,
        RELEVANCE_THRESHOLD,
        extract_datetime_strings,
        parse_dt,
        set_followup_timestamp,
        find_sensor_data_from_s3_logs,
        detect_fields_in_query,
        _reset_last_ctx
    )
    
    global TURN_ID, HISTORY
    
except ImportError as e:
    print(json.dumps({
        "error": "Failed to import chatbot module",
        "details": str(e)
    }), file=sys.stderr)
    sys.exit(1)

def process_query(query: str) -> dict:
    """
    단일 질의를 처리하고 결과를 반환
    """
    global TURN_ID, HISTORY
    
    try:
        start_time = datetime.now()
        
        # 상세 재요청 처리
        detail_ans = show_last_detail_if_any(query)
        if detail_ans:
            result = {
                "answer": detail_ans,
                "route": "sensor_detail",
                "session_id": SESSION_ID,
                "turn_id": TURN_ID + 1,
                "processing_time": (datetime.now() - start_time).total_seconds(),
                "mode": "context_reuse"
            }
            
            if ENABLE_CHATLOG_SAVE:
                TURN_ID += 1
                HISTORY.append({"query": query, "answer": detail_ans, "route": "sensor"})
                save_turn_to_s3(SESSION_ID, TURN_ID, "sensor", query, detail_ans, top_docs=[])
            
            return result

        # 후속질문 확장
        expanded_query = expand_followup_query_with_last_window(query)
        if expanded_query != query:
            query = expanded_query

        # 라우팅 결정
        route = decide_route(query)

        if route == "general":
            # 일반 질문 처리
            prompt = build_general_prompt(query, history=HISTORY)
            answer = generate_answer_with_nova(prompt)
            
            result = {
                "answer": answer,
                "route": "general",
                "session_id": SESSION_ID,
                "turn_id": TURN_ID + 1,
                "processing_time": (datetime.now() - start_time).total_seconds(),
                "mode": "general_llm"
            }
            
            TURN_ID += 1
            HISTORY.append({"query": query, "answer": answer, "route": "general"})
            if ENABLE_CHATLOG_SAVE:
                save_turn_to_s3(SESSION_ID, TURN_ID, "general", query, answer, top_docs=[])
            
            return result

        # 센서 질문 처리
        _reset_last_ctx()

        # S3 로그에서 캐시된 데이터 확인
        cached_sensor_data = find_sensor_data_from_s3_logs(query)
        
        if cached_sensor_data:
            # 캐시된 데이터로 빠른 응답
            cached_dt = datetime.strptime(cached_sensor_data['timestamp'], '%Y-%m-%d %H:%M:%S')
            set_followup_timestamp(cached_dt)
            
            need_fields = detect_fields_in_query(query)
            response_parts = []
            timestamp_str = cached_sensor_data['timestamp']
            
            if 'temperature' in need_fields and cached_sensor_data.get('temperature') is not None:
                response_parts.append(f"온도 {cached_sensor_data['temperature']}℃")
            if 'humidity' in need_fields and cached_sensor_data.get('humidity') is not None:
                response_parts.append(f"습도 {cached_sensor_data['humidity']}%")
            if 'gas' in need_fields and cached_sensor_data.get('gas') is not None:
                response_parts.append(f"CO2 {cached_sensor_data['gas']}ppm")
            
            if response_parts:
                quick_answer = f"{timestamp_str}: {', '.join(response_parts)}"
                
                result = {
                    "answer": quick_answer,
                    "route": "sensor_cache",
                    "session_id": SESSION_ID,
                    "turn_id": TURN_ID + 1,
                    "processing_time": (datetime.now() - start_time).total_seconds(),
                    "mode": "cached_data"
                }
                
                TURN_ID += 1
                HISTORY.append({"query": query, "answer": quick_answer, "route": "sensor_cache"})
                if ENABLE_CHATLOG_SAVE:
                    save_turn_to_s3(SESSION_ID, TURN_ID, "sensor_cache", query, quick_answer, top_docs=[])
                
                return result

        # S3에서 문서 검색
        top_docs, context = retrieve_documents_from_s3(query)
        
        # RAG 또는 일반 LLM 선택
        has_sensor_data = top_docs and any(
            d.get("schema") in {"raw_list","minavg","houravg","mintrend"} or 
            any(pattern in d.get("id", "").lower() 
                for pattern in ["rawdata", "houravg", "minavg", "mintrend"])
            for d in top_docs
        )
        use_rag = has_sensor_data and (top_docs[0]["score"] >= RELEVANCE_THRESHOLD)
        
        if use_rag:
            prompt = build_prompt(query, context, history=HISTORY)
            
            # 타임스탬프 추출 및 저장
            dt_strings = extract_datetime_strings(query)
            for ds in dt_strings:
                dt = parse_dt(ds)
                if dt:
                    set_followup_timestamp(dt)
                    break
        else:
            prompt = build_general_prompt(query, history=HISTORY)
        
        answer = generate_answer_with_nova(prompt)
        
        result = {
            "answer": answer,
            "route": "sensor" if use_rag else "general",
            "session_id": SESSION_ID,
            "turn_id": TURN_ID + 1,
            "processing_time": (datetime.now() - start_time).total_seconds(),
            "mode": "rag" if use_rag else "general_llm",
            "docs_found": len(top_docs) if top_docs else 0,
            "top_score": top_docs[0]["score"] if top_docs else 0
        }
        
        TURN_ID += 1
        HISTORY.append({"query": query, "answer": answer, "route": "sensor" if use_rag else "general"})
        if ENABLE_CHATLOG_SAVE:
            save_turn_to_s3(SESSION_ID, TURN_ID, "sensor" if use_rag else "general", query, answer, top_docs=top_docs)
        
        return result

    except Exception as e:
        error_msg = f"챗봇 처리 중 오류가 발생했습니다: {str(e)}"
        return {
            "answer": error_msg,
            "route": "error",
            "session_id": SESSION_ID,
            "turn_id": TURN_ID,
            "processing_time": (datetime.now() - start_time).total_seconds(),
            "mode": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    """
    메인 실행 함수
    명령행 인자 또는 stdin으로 질문을 받고 JSON 응답 출력
    """
    try:
        # 명령행 인자로 질문을 받는 경우
        if len(sys.argv) > 1:
            query = " ".join(sys.argv[1:])
        else:
            # stdin으로 JSON 입력을 받는 경우
            try:
                input_data = json.loads(sys.stdin.read())
                query = input_data.get("query", "")
            except json.JSONDecodeError:
                # 단순 텍스트 입력인 경우
                query = sys.stdin.read().strip()
        
        if not query:
            result = {
                "error": "No query provided",
                "session_id": SESSION_ID,
                "turn_id": TURN_ID
            }
        else:
            result = process_query(query)
        
        # JSON 응답 출력
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        error_result = {
            "error": "API wrapper error",
            "details": str(e),
            "traceback": traceback.format_exc(),
            "session_id": SESSION_ID,
            "turn_id": TURN_ID
        }
        print(json.dumps(error_result, ensure_ascii=False, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()