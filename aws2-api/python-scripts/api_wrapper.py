#!/usr/bin/env python3
"""
API Wrapper for chatbot.py
NestJS API와 chatbot.py 간의 인터페이스 역할
"""

import sys
import json
import traceback
from datetime import datetime

def process_chatbot_query(query: str, session_id: str = None) -> dict:
    """
    챗봇 쿼리를 처리하고 결과를 반환
    """
    try:
        # chatbot.py 모듈 import
        import chatbot
        
        start_time = datetime.now()
        
        # 세션 관리
        if not session_id:
            session_id = chatbot.SESSION_ID
            
        session = chatbot.get_or_create_session(session_id)
        
        # 후속 질문 확장 (이전 컨텍스트 활용)
        expanded_query = chatbot.expand_followup_query_with_last_window(query, session)
        
        # 라우팅 결정
        route = chatbot.decide_route(expanded_query)
        
        if route == "sensor":
            # 센서 데이터 관련 질문
            try:
                # S3에서 관련 문서 검색
                docs, context = chatbot.retrieve_documents_from_s3(expanded_query, session=session)
                
                if not context or context.strip() == "":
                    answer = "죄송합니다. 요청하신 시간대의 센서 데이터를 찾을 수 없습니다."
                    route = "sensor_no_data"
                else:
                    # 프롬프트 구성 및 Claude 호출
                    prompt = chatbot.build_prompt(expanded_query, context, session.history[-5:] if session.history else [])
                    messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
                    answer, raw_response = chatbot._invoke_claude(messages)
                    
                    # 응답이 비어있는 경우 처리
                    if not answer or answer.strip() == "":
                        answer = "죄송합니다. 요청을 처리하는 중 문제가 발생했습니다."
                        route = "sensor_error"
                        
            except Exception as sensor_error:
                answer = f"센서 데이터 처리 중 오류가 발생했습니다: {str(sensor_error)}"
                route = "sensor_error"
                
        else:
            # 일반 질문
            try:
                prompt = chatbot.build_general_prompt(expanded_query, session.history[-5:] if session.history else [])
                messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
                answer, raw_response = chatbot._invoke_claude(messages)
                route = "general"
                
                if not answer or answer.strip() == "":
                    answer = "죄송합니다. 요청을 처리하는 중 문제가 발생했습니다."
                    route = "general_error"
                    
            except Exception as general_error:
                answer = f"일반 질문 처리 중 오류가 발생했습니다: {str(general_error)}"
                route = "general_error"
        
        # 히스토리에 추가
        session.add_to_history(query, answer, route)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        result = {
            "answer": answer,
            "route": route,
            "session_id": session.session_id,
            "turn_id": len(session.history),
            "processing_time": processing_time,
            "mode": "rag" if route.startswith("sensor") else "general"
        }
        
        return result
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        error_msg = f"챗봇 처리 중 오류가 발생했습니다: {str(e)}"
        
        return {
            "answer": error_msg,
            "route": "error",
            "session_id": session_id or "",
            "turn_id": 0,
            "processing_time": processing_time,
            "mode": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }

def main():
    """
    메인 함수 - JSON 입력을 받아 처리하고 JSON 출력
    """
    try:
        # stdin에서 JSON 입력 읽기
        input_data = sys.stdin.read().strip()
        if not input_data:
            raise ValueError("No input data provided")
            
        # JSON 파싱
        try:
            request_data = json.loads(input_data)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON input: {e}")
        
        # 필수 필드 확인
        if "query" not in request_data:
            raise ValueError("Missing required field: query")
            
        query = request_data["query"]
        session_id = request_data.get("session_id")
        
        # 쿼리 처리
        result = process_chatbot_query(query, session_id)
        
        # JSON 출력
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        # 에러 응답
        error_response = {
            "error": str(e),
            "answer": "요청 처리 중 오류가 발생했습니다.",
            "route": "error",
            "session_id": "",
            "turn_id": 0,
            "processing_time": 0,
            "mode": "error",
            "traceback": traceback.format_exc()
        }
        
        print(json.dumps(error_response, ensure_ascii=False, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()