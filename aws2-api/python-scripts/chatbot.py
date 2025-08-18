import re
import time
import json
import uuid
import boto3
import traceback
import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import concurrent.futures as _f
from typing import Optional, List, Dict, Tuple

# ===== 설정 =====
REGION = "ap-northeast-2"

# S3 (데이터/로그 분리)
S3_BUCKET_DATA = "aws2-airwatch-data"   # 센서 데이터가 들어있는 버킷 (기존)
CHATLOG_BUCKET = "chatlog-1293845"      # <-- 요청하신 채팅 로그 저장용 버킷
S3_PREFIX = ""  # 데이터 폴더 구분은 키에서 자동 판단

# 로컬 히스토리 저장
HISTORY_DIR = "chat_sessions"  # 세션별 히스토리 저장 디렉토리

# ===== 히스토리 파일 관리 =====
def ensure_history_dir():
    """히스토리 저장 디렉토리 생성"""
    if not os.path.exists(HISTORY_DIR):
        os.makedirs(HISTORY_DIR)

def get_session_file_path(session_id: str) -> str:
    """세션 ID에 해당하는 파일 경로 반환"""
    ensure_history_dir()
    return os.path.join(HISTORY_DIR, f"{session_id}.json")

def save_session_history(session_id: str, history: List[Dict], turn_id: int, last_sensor_ctx: Dict = None, followup_timestamp = None, followup_context: Dict = None):
    """세션 히스토리를 파일에 저장"""
    try:
        file_path = get_session_file_path(session_id)
        
        # followup_timestamp가 datetime 객체이면 ISO 문자열로 변환
        if followup_timestamp and hasattr(followup_timestamp, 'isoformat'):
            followup_timestamp = followup_timestamp.isoformat()
            
        session_data = {
            "session_id": session_id,
            "turn_id": turn_id,
            "history": history,
            "last_sensor_ctx": last_sensor_ctx or {},
            "followup_timestamp": followup_timestamp,
            "followup_context": followup_context or {},
            "last_saved": datetime.now(KST).isoformat()
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2, default=str)
        print(f"[히스토리] 세션 {session_id} 저장됨: {len(history)}개 대화")
        return True
    except Exception as e:
        print(f"[오류] 세션 저장 실패: {e}")
        return False

def load_session_history(session_id: str) -> Tuple[List[Dict], int, Dict, str, Dict]:
    """세션 히스토리를 파일에서 로드"""
    try:
        file_path = get_session_file_path(session_id)
        if not os.path.exists(file_path):
            print(f"[히스토리] 세션 {session_id}: 새 세션 시작")
            return [], 0, {}, None, {}
            
        with open(file_path, 'r', encoding='utf-8') as f:
            session_data = json.load(f)
            
        history = session_data.get("history", [])
        turn_id = session_data.get("turn_id", 0)
        last_sensor_ctx = session_data.get("last_sensor_ctx", {})
        followup_timestamp = session_data.get("followup_timestamp")
        followup_context = session_data.get("followup_context", {})
        
        # followup_timestamp가 문자열이면 datetime으로 변환
        if followup_timestamp and isinstance(followup_timestamp, str):
            try:
                from datetime import datetime as datetime_cls
                # ISO 형식 문자열을 datetime으로 파싱
                followup_timestamp = datetime_cls.fromisoformat(followup_timestamp.replace('Z', '+00:00'))
                # KST로 변환
                followup_timestamp = _to_kst_naive(followup_timestamp)
            except Exception as parse_error:
                print(f"[경고] followup_timestamp 파싱 실패: {parse_error}")
                followup_timestamp = None
        
        print(f"[히스토리] 세션 {session_id} 로드됨: {len(history)}개 대화, 턴 ID: {turn_id}")
        return history, turn_id, last_sensor_ctx, followup_timestamp, followup_context
        
    except Exception as e:
        print(f"[오류] 세션 로드 실패: {e}")
        return [], 0, {}, None, {}

def list_session_files() -> List[str]:
    """저장된 세션 파일들의 세션 ID 목록 반환"""
    try:
        ensure_history_dir()
        files = [f for f in os.listdir(HISTORY_DIR) if f.endswith('.json')]
        session_ids = [f[:-5] for f in files]  # .json 확장자 제거
        return sorted(session_ids)
    except Exception as e:
        print(f"[오류] 세션 목록 조회 실패: {e}")
        return []

# RAG/검색
TOP_K = 8
LIMIT_CONTEXT_CHARS = 100000
MAX_FILES_TO_SCAN = 100000
MAX_WORKERS = 10
MAX_FILE_SIZE = 1024 * 1024  # 1MB
RELEVANCE_THRESHOLD = 1  # 더 관대한 임계값으로 조정

# 필드 동의어/라벨
FIELD_SYNONYMS = {
    "온도": "temperature", "temp": "temperature", "temperature": "temperature",
    "습도": "humidity", "hum": "humidity", "humidity": "humidity",
    "공기질": "gas", "가스": "gas", "gas": "gas", "ppm": "gas",
    "co2": "gas", "co₂": "gas", "이산화탄소": "gas"
}
FIELD_NAME_KOR = {"temperature": "온도", "humidity": "습도", "gas": "이산화탄소(CO2)"}

# Bedrock (Inference Profile ARN for Claude Sonnet 4)
INFERENCE_PROFILE_ARN = "arn:aws:bedrock:ap-northeast-2:070561229682:inference-profile/apac.anthropic.claude-sonnet-4-20250514-v1:0"

# ===== 클라이언트 =====
s3 = boto3.client("s3", region_name=REGION)           # 데이터 접근용
s3_logs = boto3.client("s3", region_name=REGION)      # 로그 저장용 (동일 리전)
bedrock_rt = boto3.client("bedrock-runtime", region_name=REGION)

# ===== 시간대 보정 (내부 비교는 'KST naive') =====
KST = timezone(timedelta(hours=9))
def _to_kst_naive(dt: datetime) -> datetime:
    if dt.tzinfo:
        return dt.astimezone(KST).replace(tzinfo=None)
    return dt

# ===== 토크나이저 & 정규화 =====
def tokenize(s: str):
    return re.findall(r"[A-Za-z0-9가-힣_:+-]+", s.lower())

def normalize_query_tokens(q: str):
    tokens = tokenize(q)
    return [FIELD_SYNONYMS.get(t, t) for t in tokens]

def detect_fields_in_query(raw_query: str):
    q = raw_query.lower()
    fields = set()
    if ("습도" in raw_query) or ("hum" in q) or ("humidity" in q): fields.add("humidity")
    if ("온도" in raw_query) or ("temp" in q) or ("temperature" in q): fields.add("temperature")
    if ("공기질" in raw_query) or ("가스" in raw_query) or ("gas" in q) or ("ppm" in q)or ("co2" in q) or ("co₂" in raw_query) or ("이산화탄소" in raw_query): fields.add("gas")
    return fields

def want_detail_list(query: str) -> bool:
    detail_words = ["상세", "자세히", "자세하게", "상세히", "원본", "목록"]
    q = query.strip()
    return any(word in q for word in detail_words)

# ===== 날짜/시간 파싱 =====
ISO_PAT = r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?"
def extract_datetime_strings(s: str):
    from datetime import datetime as datetime_cls
    out = []
    out += re.findall(ISO_PAT, s)  # ISO8601
    patterns = [
        r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}",
        r"\d{4}-\d{2}-\d{2}"
    ]
    for p in patterns: out += re.findall(p, s)
    
    # 한국어 날짜 파싱 - 시/분까지만 (초 제거)
    korean_patterns = [
        # 2025년 8월 11일 14시 00분
        r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분",
        # 2025년 8월 11일 14시
        r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(\d{1,2})\s*시",
        # 2025년 8월 11일
        r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",
        # 8월 11일 14시 1분의 or 8월 11일의 14시 1분 (초 언급 무시)
        r"(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:의)?\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분(?:의?\s*\d+\s*초)?",
        # 8월 11일 오후 2시 1분 (오전/오후 포함)
        r"(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분",
        # 8월 11일 오후 2시 (오전/오후 포함)
        r"(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(오전|오후)\s*(\d{1,2})\s*시",
        # 8월 11일 14시 00분 or 8월 11일의 14시 00분 (연도 없음)  
        r"(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:의)?\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분",
        # 8월 11일 14시 or 8월 11일의 14시 (연도 없음)
        r"(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:의)?\s*(\d{1,2})\s*시",
        # 8월 11일 (연도와 시간 없음)
        r"(\d{1,2})\s*월\s*(\d{1,2})\s*일"
    ]
    
    # 모든 패턴에서 시간을 찾기 위해 패턴별로 순회
    all_matches = []
    processed_dates = set()  # 이미 처리된 날짜 추적
    
    for i, pattern in enumerate(korean_patterns):
        matches = re.findall(pattern, s)
        for m in matches:
            groups = m if isinstance(m, tuple) else (m,)
            try:
                if i < 3:  # 연도가 포함된 패턴 (0, 1, 2)
                    y, mo, d = int(groups[0]), int(groups[1]), int(groups[2])
                    h = int(groups[3]) if len(groups) > 3 and groups[3] else 0
                    mi = int(groups[4]) if len(groups) > 4 and groups[4] else 0
                elif i == 3:  # "8월 11일 14시 1분의" 패턴 (초 무시)
                    y = datetime_cls.now().year
                    mo, d = int(groups[0]), int(groups[1])
                    h = int(groups[2]) if len(groups) > 2 and groups[2] else 0
                    mi = int(groups[3]) if len(groups) > 3 and groups[3] else 0
                elif i >= 4 and i <= 5:  # 오전/오후 패턴 (4, 5번 패턴)
                    y = datetime_cls.now().year
                    mo, d = int(groups[0]), int(groups[1])
                    ampm = groups[2]  # 오전/오후
                    h = int(groups[3]) if len(groups) > 3 and groups[3] else 0
                    mi = int(groups[4]) if len(groups) > 4 and groups[4] else 0
                    
                    # 오전/오후 처리
                    if ampm == "오후" and h != 12:
                        h += 12
                    elif ampm == "오전" and h == 12:
                        h = 0
                    
                    # 이 날짜를 처리했다고 표시
                    processed_dates.add((y, mo, d))
                elif i == 8:  # 날짜만 있는 패턴 (8월 13일)
                    y = datetime_cls.now().year
                    mo, d = int(groups[0]), int(groups[1])
                    
                    # 이미 더 상세한 시간 정보가 있는 날짜면 건너뛰기
                    if (y, mo, d) in processed_dates:
                        continue
                        
                    h = 0
                    mi = 0
                else:  # 연도가 없는 일반 패턴 (현재 연도로 가정)
                    y = datetime_cls.now().year
                    mo, d = int(groups[0]), int(groups[1])
                    h = int(groups[2]) if len(groups) > 2 and groups[2] else 0
                    mi = int(groups[3]) if len(groups) > 3 and groups[3] else 0
                
                time_str = f"{y:04d}-{mo:02d}-{d:02d} {h:02d}:{mi:02d}"
                if time_str not in all_matches:  # 중복 제거
                    all_matches.append(time_str)
                    
            except (ValueError, IndexError):
                continue
    
    # 추가로 "오후 X시" 형태의 패턴을 별도로 찾기 (날짜 없이)
    standalone_time_pattern = r"(오전|오후)\s*(\d{1,2})\s*시"
    standalone_matches = re.findall(standalone_time_pattern, s)
    
    # 이미 전체 패턴에서 찾은 시간들을 확인
    existing_hours = set()
    for match in all_matches:
        hour = int(match.split()[1].split(':')[0])
        existing_hours.add(hour)
    
    for ampm, hour_str in standalone_matches:
        try:
            h = int(hour_str)
            if ampm == "오후" and h != 12:
                h += 12
            elif ampm == "오전" and h == 12:
                h = 0
            
            # 이미 해당 시간이 추출되었으면 건너뛰기
            if h in existing_hours:
                continue
                
            y = datetime_cls.now().year
            # 이미 찾은 첫 번째 시간에서 날짜 정보 추출
            if all_matches:
                first_match = all_matches[0]
                y, mo, d = map(int, first_match.split()[0].split('-')[:3])
            else:
                # 날짜 정보가 없으면 오늘 날짜 사용
                mo, d = 8, 13  # 기본값으로 8월 13일 사용
                
            time_str = f"{y:04d}-{mo:02d}-{d:02d} {h:02d}:00"
            if time_str not in all_matches:
                all_matches.append(time_str)
                existing_hours.add(h)
                
        except (ValueError, IndexError):
            continue
    
    out.extend(all_matches)
    
    return out

def extract_time_range_from_query(query: str):
    """범위 쿼리(~부터 ~까지)에서 시작과 끝 시간 추출"""
    from datetime import datetime as datetime_cls
    
    # "X부터 Y까지", "X에서 Y까지" 패턴 매칭
    range_patterns = [
        r"(\d{1,2})\s*시\s*부터\s*(\d{1,2})\s*시",  # "1시부터 3시"
        r"오후\s*(\d{1,2})\s*시\s*부터\s*오후\s*(\d{1,2})\s*시",  # "오후 1시부터 오후 3시"
        r"(\d{1,2})\s*시\s*에서\s*(\d{1,2})\s*시",  # "1시에서 3시"
    ]
    
    # 날짜 정보 추출
    date_match = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", query)
    if not date_match:
        return None
    
    year = datetime_cls.now().year
    month, day = int(date_match.group(1)), int(date_match.group(2))
    
    for pattern in range_patterns:
        match = re.search(pattern, query)
        if match:
            start_hour = int(match.group(1))
            end_hour = int(match.group(2))
            
            # 오후 처리
            if "오후" in query:
                if start_hour != 12:
                    start_hour += 12
                if end_hour != 12:
                    end_hour += 12
            
            # 시간 범위 생성
            time_range = []
            for hour in range(start_hour, end_hour + 1):
                time_str = f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:00"
                time_range.append(time_str)
            
            return time_range
    
    return None

def calculate_daily_average_temperature(query: str):
    """특정 날짜의 일간 평균 온도 계산 (houravg 데이터 활용)"""
    import re
    from datetime import datetime as datetime_cls
    import boto3
    import json
    
    # 날짜 추출
    date_match = re.search(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", query)
    if not date_match:
        return None
    
    year = datetime_cls.now().year
    month, day = int(date_match.group(1)), int(date_match.group(2))
    date_prefix = f"{year:04d}{month:02d}{day:02d}"
    
    # S3에서 해당 날짜의 houravg 데이터 검색
    s3 = boto3.client("s3", region_name=REGION)
    paginator = s3.get_paginator("list_objects_v2")
    
    temperature_values = []
    hour_data = []
    
    try:
        search_prefix = f"{S3_PREFIX}houravg/{year:04d}/{month:02d}/{day:02d}/"
        print(f"[DEBUG] 일간 평균 검색: {search_prefix}")
        pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 100})
        
        for page in pages:
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if key.lower().endswith(".json"):
                    try:
                        obj_data = s3.get_object(Bucket=S3_BUCKET_DATA, Key=key)
                        data = json.loads(obj_data['Body'].read().decode('utf-8'))
                        
                        # houravg 데이터에서 온도 값 추출 (다양한 필드명 시도)
                        temp_value = None
                        
                        # 가능한 온도 필드명들
                        temp_fields = ['hourtemp', 'temperature', 'temp', 'avg_temp', 'hourly_temp']
                        for field in temp_fields:
                            if field in data and data[field] is not None:
                                temp_value = data[field]
                                break
                        
                        # averages 구조 내부도 확인
                        if temp_value is None and 'averages' in data:
                            avg_data = data['averages']
                            for field in ['temperature', 'temp', 'hourtemp']:
                                if field in avg_data and avg_data[field] is not None:
                                    temp_value = avg_data[field]
                                    break
                        
                        if temp_value is not None:
                            temperature_values.append(temp_value)
                            hour_info = {
                                'hour': int(key.split('/')[-1].split('_')[0][-2:]),  # 시간 추출
                                'temp': temp_value,
                                'key': key
                            }
                            hour_data.append(hour_info)
                            print(f"[DEBUG] 온도 데이터 추가: {temp_value}도 (키: {key})")
                    except Exception:
                        continue
    except Exception:
        return None
    
    if not temperature_values:
        print(f"[DEBUG] 온도 데이터가 없어서 None 반환")
        return None
    
    # 평균 계산
    daily_avg = sum(temperature_values) / len(temperature_values)
    min_temp = min(temperature_values)
    max_temp = max(temperature_values)
    
    print(f"[DEBUG] 일간 평균 계산 완료: {daily_avg:.2f}도 ({len(temperature_values)}시간)")
    
    return {
        'date': f"{year}년 {month}월 {day}일",
        'average': round(daily_avg, 2),
        'min': round(min_temp, 2),
        'max': round(max_temp, 2),
        'data_count': len(temperature_values),
        'hour_data': sorted(hour_data, key=lambda x: x['hour'])
    }

def parse_dt(dt_str: str):
    try:
        s = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return _to_kst_naive(dt)
    except Exception:
        pass
    for f in ["%Y-%m-%d %H:%M", "%Y-%m-%d %H", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(dt_str, f)
            return _to_kst_naive(dt)
        except Exception:
            pass
    return None

# === 질의 단위 감지 ===
def minute_requested(query: str) -> bool:
    q = query.strip()
    if re.search(r"\d{1,2}\s*시\s*\d{1,2}\s*분", q): return True
    if re.search(r"\b\d{1,2}\s*분\b", q): return True
    if re.search(r"(?:\b|t)\d{1,2}:\d{2}\b", q, flags=re.IGNORECASE): return True
    # "정각" 키워드가 있으면 minute 데이터 요청
    if re.search(r"정각", q): return True
    return False


def hour_bucket_requested(query: str) -> bool:
    q = query.strip()
    if minute_requested(q):
        return False
    return bool(re.search(r"(\d{1,2})\s*시", q))

def hourly_average_requested(query: str) -> bool:
    """시간별 평균을 요청하는지 확인"""
    query_lower = query.lower()
    
    # 평균 관련 키워드
    avg_patterns = ["평균", "average", "avg"]
    # 시간 관련 키워드
    hour_patterns = ["시간", "시", "hour", "전체", "그시간", "해당시간"]
    # 온도/센서 데이터 요청 키워드
    data_patterns = ["온도", "습도", "가스", "이산화탄소", "공기질", "temperature", "humidity"]
    
    has_avg = any(pattern in query_lower for pattern in avg_patterns)
    has_hour_context = any(pattern in query_lower for pattern in hour_patterns)
    has_data_request = any(pattern in query_lower for pattern in data_patterns)
    
    # 명시적으로 일간이 아니고, (평균과 시간) 또는 (시간과 데이터요청)이 있으면 true
    not_daily = not any(word in query_lower for word in ["일평균", "하루평균", "일간", "하루", "daily", "day"])
    
    # 특정 시간대의 온도/센서 데이터를 묻는 경우도 시간별 처리로 간주
    specific_time_data = has_hour_context and has_data_request and not_daily
    
    return (has_avg and has_hour_context and not_daily) or specific_time_data

def daily_summary_requested(query: str) -> bool:
    """일간 요약을 요청하는지 확인"""
    query_lower = query.lower()
    
    # 평균 관련 키워드
    avg_patterns = ["평균", "average", "avg"]
    # 추이 관련 키워드  
    trend_patterns = ["추이", "trend", "변화", "흐름"]
    # 일간 관련 키워드
    daily_patterns = ["일", "하루", "daily", "day"]
    
    # 평균이나 추이 중 하나라도 있고, 특정 날짜나 일간 관련 키워드가 있으면 true
    has_metric = any(pattern in query_lower for pattern in avg_patterns + trend_patterns)
    has_daily_context = any(pattern in query_lower for pattern in daily_patterns)
    
    # 또는 명시적인 일간 키워드들
    explicit_daily = any(word in query_lower for word in ["일평균", "하루평균", "일간", "일추이", "하루추이"])
    
    return (has_metric and has_daily_context) or explicit_daily

def is_recent_query(query: str) -> bool:
    """현재 시간 기준 최근 데이터를 요청하는지 확인"""
    recent_patterns = [
        r'최근', r'지금', r'현재', r'최신', r'가장.*최근', r'가장.*최신',
        r'\d+\s*분\s*전', r'\d+\s*시간?\s*전', r'\d+\s*일\s*전',
        r'latest', r'recent', r'current', r'now'
    ]
    q = query.lower()
    return any(re.search(pattern, q) for pattern in recent_patterns)

def extract_time_offset(query: str) -> tuple:
    """쿼리에서 시간 오프셋 추출 (예: '30분 전' -> 30, 'minute', '두 시간 전' -> 2, 'hour')"""
    patterns = [
        (r'(\d+)\s*분\s*전', 'minute'),
        (r'(\d+)\s*시간?\s*전', 'hour'), 
        (r'(\d+)\s*일\s*전', 'day'),
        (r'어제', 'yesterday'),
        (r'그저께|그제', 'day_before_yesterday'),
        # 한글 숫자 패턴 추가
        (r'한\s*시간\s*전', 'hour_1'),
        (r'두\s*시간\s*전', 'hour_2'),
        (r'세\s*시간\s*전', 'hour_3'),
        (r'네\s*시간\s*전', 'hour_4'),
        (r'다섯\s*시간\s*전', 'hour_5'),
        (r'열\s*분\s*전', 'minute_10'),
        (r'스무\s*분\s*전|이십\s*분\s*전', 'minute_20'),
        (r'삼십\s*분\s*전', 'minute_30')
    ]
    
    for pattern, unit in patterns:
        match = re.search(pattern, query)
        if match:
            if unit == 'yesterday':
                return 1, 'day'
            elif unit == 'day_before_yesterday':
                return 2, 'day'
            elif unit.startswith('hour_'):
                return int(unit.split('_')[1]), 'hour'
            elif unit.startswith('minute_'):
                return int(unit.split('_')[1]), 'minute'
            else:
                return int(match.group(1)), unit
    
    return None, None

def requested_granularity(query: str) -> Optional[str]:
    # 분 정보가 명시적으로 있으면 minute 사용
    if minute_requested(query) or ("분의" in query): return "minute"
    # 시간만 있고 분이 없으면 hour 사용 (houravg 우선)
    if hour_bucket_requested(query): return "hour"
    return None

def get_time_range_from_query(query: str):
    q = query.strip()
    m = re.search(r"(.*?)부터\s+(.*?)까지", q)
    if m:
        s1, s2 = m.group(1), m.group(2)
        dts = extract_datetime_strings(s1) + extract_datetime_strings(s2)
        if len(dts) >= 2:
            start, end = parse_dt(dts[0]), parse_dt(dts[1])
            if start and end and start < end: return start, end
    m = re.search(r"(.*?)~(.*)", q)
    if m:
        s1, s2 = m.group(1), m.group(2)
        dts = extract_datetime_strings(s1) + extract_datetime_strings(s2)
        if len(dts) >= 2:
            start, end = parse_dt(dts[0]), parse_dt(dts[1])
            if start and end and start < end: return start, end
    m = re.search(r"between\s+(.*?)\s+(?:and|to)\s+(.*)", q, flags=re.I)
    if m:
        s1, s2 = m.group(1), m.group(2)
        dts = extract_datetime_strings(s1) + extract_datetime_strings(s2)
        if len(dts) >= 2:
            start, end = parse_dt(dts[0]), parse_dt(dts[1])
            if start and end and start < end: return start, end
    return None, None

def get_duration_range_from_query(query: str):
    if "부터" not in query: return None, None, None
    start_dt = None
    for ds in extract_datetime_strings(query):
        dt = parse_dt(ds)
        if dt: start_dt = dt; break
    if not start_dt: return None, None, None
    after = query.split("부터", 1)[1]
    m_min = re.search(r"(\d+)\s*분", after)
    if m_min:
        minutes = int(m_min.group(1))
        if minutes > 0:
            end_dt = start_dt + timedelta(minutes=minutes) - timedelta(seconds=1)
            return start_dt, end_dt, minutes
    m_hr = re.search(r"(\d+)\s*(?:시간|hour|hours)", after, flags=re.I)
    if m_hr:
        hours = int(m_hr.group(1))
        if hours > 0:
            minutes = hours * 60
            end_dt = start_dt + timedelta(hours=hours) - timedelta(seconds=1)
            return start_dt, end_dt, minutes
    m_day = re.search(r"(\d+)\s*(?:일|day|days)", after, flags=re.I)
    if m_day:
        days = int(m_day.group(1))
        if days > 0:
            minutes = days * 24 * 60
            end_dt = start_dt + timedelta(days=days) - timedelta(seconds=1)
            return start_dt, end_dt, minutes
    return None, None, None

def get_minute_to_minute_range(query: str):
    base = None
    for ds in extract_datetime_strings(query):
        dt = parse_dt(ds)
        if dt: base = dt; break
    if not base: return None, None
    m = re.search(r"(\d{1,2})\s*분부터\s*(\d{1,2})\s*분까지", query)
    if m:
        start_min = int(m.group(1)); end_min = int(m.group(2))
        if 0 <= start_min <= 59 and 0 <= end_min <= 59 and end_min > start_min:
            start_dt = base.replace(minute=start_min, second=0)
            end_dt   = base.replace(minute=end_min, second=0) - timedelta(seconds=1)
            return start_dt, end_dt
    m2 = re.search(r"분부터\s*(\d{1,2})\s*분까지", query)
    if m2:
        end_min = int(m2.group(1)); start_min = base.minute
        if 0 <= start_min <= 59 and 0 <= end_min <= 59 and end_min > start_min:
            start_dt = base.replace(minute=start_min, second=0)
            end_dt   = base.replace(minute=end_min, second=0) - timedelta(seconds=1)
            return start_dt, end_dt
    return None, None

# ===== 파일명에서 시간 추출 =====
def parse_time_from_key(key: str):
    """
    파일명/경로에서 시간 단서를 찾아 datetime(naive KST)로 반환.
    우선순위: YYYYMMDD_HHMM > YYYYMMDDHH > YYYY-MM-DDTHH:MM > YYYY-MM-DD
    반환: (dt, granularity)  # granularity in {"minute","hour","day",None}
    """
    base = key.lower()

    # 20250808_1518
    m = re.search(r"(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})", base)
    if m:
        y, mo, d, hh, mm = map(int, m.groups())
        # hourtrend나 houravg 경로면 시간 단위로 강제 설정
        if "hourtrend" in base or "houravg" in base:
            return datetime(y, mo, d, hh, 0), "hour"
        return datetime(y, mo, d, hh, mm), "minute"

    # 2025080815 (hour)
    m = re.search(r"(\d{4})(\d{2})(\d{2})(\d{2})(?!\d)", base)
    if m:
        y, mo, d, hh = map(int, m.groups())
        return datetime(y, mo, d, hh, 0), "hour"

    # 2025-08-08T15:18 or 2025-08-08T15
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})t(\d{2})(?::(\d{2}))?", base)
    if m:
        y, mo, d, hh, mm = m.groups()
        y, mo, d, hh = int(y), int(mo), int(d), int(hh)
        mm = int(mm) if mm else 0
        return datetime(y, mo, d, hh, mm), ("minute" if mm else "hour")

    # 2025-08-08 (day)
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})(?![\d:])", base)
    if m:
        y, mo, d = map(int, m.groups())
        return datetime(y, mo, d), "day"

    return None, None

# ===== 스코어링 =====
def score_doc(query: str, text: str, key: str = "") -> int:
    text_l = text.lower()
    q_tokens = normalize_query_tokens(query)
    score = 0
    
    # 기본 파일 타입 점수 (평균 데이터만 사용)
    if "minavg" in key.lower() or "mintrend" in key.lower():
        score += 8   # 분 단위 집계
    elif "hourtrend" in key.lower() or "houravg" in key.lower():
        score += 6   # 시간 단위 집계

    for qt in q_tokens:
        if len(qt) >= 2:
            score += text_l.count(qt)

    # 기본 필드 점수 (기존과 동일)
    for k in ["\"temperature\"", "\"humidity\"", "\"gas\"", "\"temp\"", "\"hum\""]:
        if k in text_l:
            score += 1

    dt_strs = extract_datetime_strings(query)
    for ds in dt_strs:
        if ds.lower() in text_l:
            score += 5

    # 파일명-시각 매칭 가산점 (대폭 증가)
    target_dt = None
    for ds in dt_strs:
        dd = parse_dt(ds)
        if dd:
            target_dt = dd
            break
    if key and target_dt:
        key_dt, gran_key = parse_time_from_key(key)
        if key_dt:
            gran_query = requested_granularity(query)
            
            # 정확한 시각 매칭만 점수 부여 (부정확한 매칭 제거)
            if gran_key == "minute" and (key_dt.year,key_dt.month,key_dt.day,key_dt.hour,key_dt.minute) == \
               (target_dt.year,target_dt.month,target_dt.day,target_dt.hour,target_dt.minute):
                score += 200  # 분 정확 매칭 시 대폭 가산
            elif gran_key == "hour" and (key_dt.year,key_dt.month,key_dt.day,key_dt.hour) == \
                 (target_dt.year,target_dt.month,target_dt.day,target_dt.hour):
                # 분 쿼리에 대해서는 시간 데이터만 fallback으로 허용
                if gran_query == "minute":
                    score += 50  # 분 쿼리의 시간 fallback
                elif gran_query == "hour":
                    score += 200  # 시간 질의와 시간 파일 정확 매칭
            # 같은 날짜라도 시간이 다르면 점수를 주지 않음 (부정확한 매칭 방지)

    # 평균 데이터만 사용하는 간단한 스코어링
    requested_gran = requested_granularity(query)
    
    if requested_gran == "minute":
        # 분 단위 요청: minavg 최우선
        if "\"averages\"" in text_l and ("\"minute\"" in text_l or "\"calculatedAt\"" in text_l):
            score += 30  # minavg 데이터
        elif "minavg" in key.lower() or "mintrend" in key.lower():
            score += 25  # minavg 경로
            
    elif requested_gran == "hour":
        # 시간 단위 요청: houravg 최우선
        if "\"averages\"" in text_l and "\"hourly_ranges\"" in text_l:
            score += 35  # houravg 데이터
        elif "houravg" in key.lower() or "hourtrend" in key.lower():
            score += 30  # houravg 경로
    
    else:
        # granularity 불명확한 경우: houravg 우선
        if "\"averages\"" in text_l and "\"hourly_ranges\"" in text_l:
            score += 20  # houravg 데이터
        elif "houravg" in key.lower() or "hourtrend" in key.lower():
            score += 15  # houravg 경로
        elif "\"averages\"" in text_l and ("\"minute\"" in text_l or "\"calculatedAt\"" in text_l):
            score += 10  # minavg 데이터
        elif "minavg" in key.lower() or "mintrend" in key.lower():
            score += 8   # minavg 경로

    # 디버깅 코드 제거 (is_debug 변수 문제로 인해)

    return score

# ===== JSON 스키마 감지 =====
def detect_schema(obj):
    """
    returns: "raw_list" | "minavg" | "houravg" | "mintrend" | None
    """
    # rawdata: 리스트 형태의 5초 간격 데이터
    if isinstance(obj, list) and obj and isinstance(obj[0], dict):
        k = set(obj[0].keys())
        if {"timestamp", "temp", "hum", "gas"}.issubset(k): return "raw_list"
        if {"timestamp", "temperature", "humidity", "gas"}.issubset(k): return "raw_list"
    
    if isinstance(obj, dict):
        # hourtrend: averages와 hourly_ranges, trends를 모두 가진 구조
        if "averages" in obj and "hourly_ranges" in obj and "trends" in obj:
            return "houravg"
        
        # houravg: 단순한 시간별 평균 (hourtemp, hourhum, hourgas)
        if "hourtemp" in obj and "hourhum" in obj and "hourgas" in obj:
            return "houravg"
            
        # minavg: 분별 평균 (mintemp, minhum, mingas)
        if "mintemp" in obj and "minhum" in obj and "mingas" in obj:
            return "minavg"
            
        # mintrend: data 안에 분별 데이터가 있는 구조
        if "data" in obj and isinstance(obj["data"], dict):
            data = obj["data"]
            if "mintemp" in data and "minhum" in data and "mingas" in data:
                return "mintrend"
        
        # 기존 averages 기반 감지 (백업용)
        if "averages" in obj and ("minute" in obj or "timestamp" in obj or "calculatedAt" in obj): 
            return "minavg"
    
    return None

# ===== S3 다운로드/스코어 (스키마 포함) =====
def download_and_score_file(key: str, query: str):
    try:
        head_resp = s3.head_object(Bucket=S3_BUCKET_DATA, Key=key)
        file_size = head_resp.get('ContentLength', 0)
        if file_size > MAX_FILE_SIZE:
            obj = s3.get_object(Bucket=S3_BUCKET_DATA, Key=key, Range=f"bytes=0-{MAX_FILE_SIZE-1}")
        else:
            obj = s3.get_object(Bucket=S3_BUCKET_DATA, Key=key)
        data = obj["Body"].read()
        txt = data.decode("utf-8", errors="ignore")
        if not txt.strip(): 
            return None

        schema = None
        j = None
        try:
            # 먼저 전체 텍스트를 JSON으로 파싱 시도
            j = json.loads(txt)
            schema = detect_schema(j)
        except Exception:
            try:
                # 실패하면 JSON이 여러 줄로 되어 있을 수 있으므로 라인별로 파싱
                lines = txt.strip().split('\n')
                if len(lines) == 1:
                    # 한 줄이면 단일 객체
                    j = json.loads(lines[0])
                    schema = detect_schema(j)
                else:
                    # 여러 줄이면 JSON Lines 형태일 가능성
                    json_objects = []
                    for line in lines:
                        line = line.strip()
                        if line:
                            json_objects.append(json.loads(line))
                    if json_objects:
                        if len(json_objects) == 1:
                            j = json_objects[0]
                        else:
                            j = json_objects  # 리스트로 처리
                        schema = detect_schema(j)
            except Exception:
                # 마지막으로 기존 방식 시도
                try:
                    start = txt.find("{"); alt_start = txt.find("[")
                    if alt_start != -1 and (start == -1 or alt_start < start): start = alt_start
                    end = max(txt.rfind("}"), txt.rfind("]"))
                    if start != -1 and end != -1 and end > start:
                        j = json.loads(txt[start:end+1])
                        schema = detect_schema(j)
                except Exception:
                    pass

        sc = score_doc(query, txt, key=key)
        
        # 간단한 스키마 점수 (RAG 모드용)
        if schema == "raw_list": sc += 5
        elif schema == "minavg": sc += 4
        elif schema == "houravg": sc += 3

        return {"id": key, "content": txt, "score": sc, "file_size": file_size, "schema": schema, "json": j}
    except Exception:
        return None

# ===== 빠른 증거 스니핑 =====
def quick_sensor_evidence(query: str, max_probe: int = 6) -> dict:
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX)

    keys = []
    for page in pages:
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if not k.lower().endswith(".json"):
                continue
            keys.append(k)
            if len(keys) >= MAX_FILES_TO_SCAN:
                break
        if len(keys) >= MAX_FILES_TO_SCAN:
            break
    if not keys:
        return {'has_schema': False, 'best_schema': None, 'best_score': 0}

    scored = []
    with _f.ThreadPoolExecutor(max_workers=min(6, MAX_WORKERS)) as ex:
        futs = {ex.submit(download_and_score_file, k, query): k for k in keys[:max_probe]}
        for f in _f.as_completed(futs):
            r = f.result()
            if r:
                scored.append(r)
    if not scored:
        return {'has_schema': False, 'best_schema': None, 'best_score': 0}

    top = sorted(scored, key=lambda x: x["score"], reverse=True)[0]
    return {
        'has_schema': top.get("schema") in {"raw_list","minavg","houravg"},
        'best_schema': top.get("schema"),
        'best_score': top.get("score", 0)
    }

# ===== LLM 기반 의도 분류 =====
def _build_intent_prompt(query: str) -> str:
    return (
        "You are a router. Classify the user's query domain.\n"
        "Return STRICT JSON: {\"domain\": \"sensor_data\"|\"general\", \"confidence\": 0.0-1.0}.\n"
        "- Choose \"sensor_data\" ONLY if the user is asking about IoT environmental readings "
        "(temperature/humidity/gas/ppm) from my stored device data, with a time window "
        "(특정 날짜/시/분/초, '부터~까지', '최근', '처음/마지막') or stats (평균/최대/최소/추이 등).\n"
        "- Weather forecasts, sports, finance, 일반 상식 등은 \"general\".\n"
        "- IMPORTANT: 한국어 질의에서 '날씨 예보'가 아니라 '내 센서 로그'일 수 있음.\n\n"
        "Examples:\n"
        "Q: 메시의 경기마다 평균 몇 골을 넣어? → {\"domain\":\"general\",\"confidence\":0.95}\n"
        "Q: 내일 서울 날씨 어때? → {\"domain\":\"general\",\"confidence\":0.95}\n"
        "Q: 2025년 8월 8일 16시 온도, 습도, 공기질을 알려줘 → {\"domain\":\"sensor_data\",\"confidence\":0.95}\n"
        "Q: 2025-08-11 10:15:15 습도? → {\"domain\":\"sensor_data\",\"confidence\":0.95}\n"
        "Q: 최근 공기질 평균 보여줘 → {\"domain\":\"sensor_data\",\"confidence\":0.9}\n"
        "Q: esp32s3-airwatch 15:18 온도 평균 → {\"domain\":\"sensor_data\",\"confidence\":0.95}\n\n"
        f"query: {query}\n"
        "json:"
    )

def _invoke_claude(messages, max_tokens=512, temperature=0.0, top_p=0.9, system=None):
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
    }
    if system:
        body["system"] = system

    resp = bedrock_rt.invoke_model(
        modelId=INFERENCE_PROFILE_ARN,
        accept="application/json",
        contentType="application/json",
        body=json.dumps(body).encode("utf-8"),
    )
    payload = json.loads(resp["body"].read().decode("utf-8", errors="ignore"))
    text = "".join(
        p.get("text", "")
        for p in (payload.get("content") or [])
        if isinstance(p, dict) and p.get("type") == "text"
    ).strip()
    return text, payload

@lru_cache(maxsize=256)
def classify_query_with_llm(query: str) -> dict:
    user_text = _build_intent_prompt(query)
    messages = [
        {"role": "user", "content": [{"type": "text", "text": user_text}]}
    ]
    text, _raw = _invoke_claude(messages, max_tokens=64, temperature=0.0, top_p=0.9)
    try:
        out = json.loads(text)
        dom = out.get("domain", "general")
        conf = float(out.get("confidence", 0.0))
        if dom not in ("sensor_data","general"): dom = "general"
        conf = max(0.0, min(1.0, conf))
        return {"domain": dom, "confidence": conf}
    except Exception:
        return {"domain": "general", "confidence": 0.0}

# ===== 결정적 신호(센서 단어 + 시간/구간 토큰) 가드레일 =====
_TIME_HINTS = ("년", "월", "일", "시", "분", "초", "-", ":", "부터", "까지", "~", "between")
_RANGE_HINTS = ("구간", "최근", "처음", "첫", "마지막", "최종")
def _deterministic_sensor_signal(query: str) -> bool:
    fields = detect_fields_in_query(query)
    if not fields:
        return False
    has_time_literal = bool(extract_datetime_strings(query))
    has_ko_time_tokens = any(tok in query for tok in _TIME_HINTS)
    has_range = any(tok in query for tok in _RANGE_HINTS)
    return has_time_literal or has_ko_time_tokens or has_range

def decide_route(query: str) -> str:
    # UTF-8 문제 해결을 위한 간단한 센서 감지
    sensor_keywords = ["온도", "습도", "CO2", "이산화탄소", "공기질", "센서"]
    time_keywords = ["시", "분", "일", "월", "년", "전", "후", "오전", "오후"]
    
    has_sensor = any(keyword in query for keyword in sensor_keywords)
    has_time = any(keyword in query for keyword in time_keywords)
    
    if has_sensor and has_time:
        return "sensor"
    
    if _deterministic_sensor_signal(query):
        return "sensor"

    cls = classify_query_with_llm(query)
    dom, conf = cls["domain"], cls["confidence"]

    if dom == "sensor_data" and conf >= 0.6:
        return "sensor"
    if 0.4 <= conf < 0.6:
        ev = quick_sensor_evidence(query)
        if ev["has_schema"] and ev["best_score"] >= RELEVANCE_THRESHOLD:
            return "sensor"
        return "general"
    return "general"

# ===== 검색 =====
def find_latest_sensor_data_from_s3(query: str) -> dict:
    """현재 시간 기준으로 가장 최근 센서 데이터 파일을 S3에서 찾기"""
    from datetime import datetime as datetime_cls, timedelta
    now = datetime_cls.now()
    
    # 시간 오프셋 처리 (예: '30분 전')
    offset_value, offset_unit = extract_time_offset(query)
    if offset_value and offset_unit:
        if offset_unit == 'minute':
            target_time = now - timedelta(minutes=offset_value)
        elif offset_unit == 'hour':
            target_time = now - timedelta(hours=offset_value)
        elif offset_unit == 'day':
            # 상대적 날짜 + 시간 조합 처리 (예: "어제 17시")
            base_dt = now - timedelta(days=offset_value)
            
            # 쿼리에서 시간 정보 추출 시도
            # 오전/오후 패턴 먼저 확인
            ampm_match = re.search(r'(오전|오후)\s*(\d{1,2})\s*시', query)
            hour_match = re.search(r'(\d{1,2})\s*시', query)
            minute_match = re.search(r'(\d{1,2})\s*분', query)
            
            if ampm_match:
                ampm = ampm_match.group(1)
                hour = int(ampm_match.group(2))
                minute = int(minute_match.group(1)) if minute_match else 0
                
                # 오전/오후 처리
                if ampm == "오후" and hour != 12:
                    hour += 12
                elif ampm == "오전" and hour == 12:
                    hour = 0
                    
                target_time = base_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
            elif hour_match:
                hour = int(hour_match.group(1))
                minute = int(minute_match.group(1)) if minute_match else 0
                # 어제의 해당 시간으로 설정
                target_time = base_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
            else:
                # 시간 정보가 없으면 해당 날짜의 현재 시간
                target_time = base_dt
        else:
            target_time = now
    else:
        target_time = now
    
    
    # 최근 데이터 검색을 위해 현재부터 과거로 역순 검색
    latest_files = []
    paginator = s3.get_paginator("list_objects_v2")
    
    # 오프셋이 있는 경우 (3시간 전, 30분 전) 더 정밀하게 검색
    if offset_value and offset_unit:
        # 대상 시간 주변을 검색 (해당 시간 + 다음 시간까지)
        search_hours = [target_time, target_time + timedelta(hours=1)]
        
        for search_time in search_hours:
            year = search_time.strftime('%Y')
            month = search_time.strftime('%m') 
            day = search_time.strftime('%d')
            hour = search_time.strftime('%H')
            
            # minavg 우선 (분 단위 정확도)
            for prefix_path in ["minavg/"]:
                try:
                    search_prefix = f"{S3_PREFIX}{prefix_path}{year}/{month}/{day}/{hour}/"
                    
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 200})
                    all_files_in_hour = []
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            if k.lower().endswith(".json"):
                                all_files_in_hour.append({
                                    'key': k,
                                    'last_modified': obj['LastModified'],
                                    'path_time': search_time
                                })
                    
                    if all_files_in_hour:
                        latest_files.extend(all_files_in_hour)
                        
                except Exception as e:
                    pass
        
        # 오프셋 검색에서 파일을 찾았으면 더 정밀한 선택 로직 적용
        if latest_files:
            # 가장 가까운 시간의 파일 선택
            target_timestamp = int(target_time.strftime('%Y%m%d%H%M'))
            best_file = None
            min_time_diff = float('inf')
            
            for file_info in latest_files:
                filename = file_info['key'].split('/')[-1]
                if '_' in filename:
                    file_timestamp_str = filename.split('_')[0]
                    if len(file_timestamp_str) >= 12:
                        try:
                            file_timestamp = int(file_timestamp_str)
                            time_diff = abs(file_timestamp - target_timestamp)
                            if time_diff < min_time_diff:
                                min_time_diff = time_diff
                                best_file = file_info
                        except:
                            continue
            
            if best_file:
                latest_files = [best_file]  # 최적 파일만 선택
    
    # 오프셋 검색에서도 파일을 찾지 못했다면, 더 넓은 범위에서 가장 가까운 시간부터 검색
    if not latest_files:
        # 대상 시간 기준으로 가장 가까운 시간부터 순차적으로 검색 (0, ±1, ±2, ±3...)
        for hours_diff in range(0, 73):  # 0~72시간(3일) 차이까지
            search_offsets = []
            if hours_diff == 0:
                search_offsets = [0]
            else:
                search_offsets = [-hours_diff, hours_diff]  # -3시간, +3시간 동시에 검색
                
            for hours_offset in search_offsets:
                search_time = target_time + timedelta(hours=hours_offset)
                year = search_time.strftime('%Y')
                month = search_time.strftime('%m') 
                day = search_time.strftime('%d')
                hour = search_time.strftime('%H')
                
                # minavg, houravg 순으로 검색
                for prefix_path in ["minavg/", "houravg/"]:
                    try:
                        search_prefix = f"{S3_PREFIX}{prefix_path}{year}/{month}/{day}/{hour}/"
                        pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 200})
                        
                        for page in pages:
                            for obj in page.get("Contents", []):
                                k = obj["Key"]
                                if k.lower().endswith(".json"):
                                    latest_files.append({
                                        'key': k,
                                        'last_modified': obj['LastModified'],
                                        'path_time': search_time
                                    })
                        
                        # 첫 번째로 파일을 찾으면 중단 (가장 가까운 시간)
                        if latest_files:
                            break
                            
                    except Exception as e:
                        pass
                
                # 파일을 찾았으면 더 이상 검색하지 않음
                if latest_files:
                    break
            
            # 파일을 찾았으면 더 이상 검색하지 않음  
            if latest_files:
                break
        
    # 가장 가까운 시간의 파일 선택 (오프셋 기반 또는 확장 검색)
    if latest_files:
        if offset_value and offset_unit:
            # 오프셋이 있는 경우: 대상 시간에서 가장 가까운 파일 선택
            target_timestamp = int(target_time.strftime('%Y%m%d%H%M'))
            best_file = None
            min_time_diff = float('inf')
            
            for file_info in latest_files:
                filename = file_info['key'].split('/')[-1]
                if '_' in filename:
                    file_timestamp_str = filename.split('_')[0]
                    if len(file_timestamp_str) >= 12:
                        try:
                            file_timestamp = int(file_timestamp_str)
                            time_diff = abs(file_timestamp - target_timestamp)
                            if time_diff < min_time_diff:
                                min_time_diff = time_diff
                                best_file = file_info
                        except:
                            continue
            
            if best_file:
                latest_files = [best_file]
            else:
                # 파일명의 타임스탬프 부분으로 정렬 (최신 우선)
                latest_files.sort(key=lambda x: x['key'].split('/')[-1], reverse=True)
        else:
            # 일반적인 경우: 가장 최근 파일
            latest_files.sort(key=lambda x: x['key'].split('/')[-1], reverse=True)
        latest_key = latest_files[0]['key']
        
        try:
            obj = s3.get_object(Bucket=S3_BUCKET_DATA, Key=latest_key)
            data = json.loads(obj['Body'].read().decode('utf-8'))
            return {
                'key': latest_key,
                'data': data,
                'timestamp': latest_files[0]['path_time'].strftime('%Y-%m-%d %H:%M:%S')
            }
        except Exception as e:
            pass
    
    return None

def find_minavg_data(target_time: datetime) -> dict:
    """특정 시간의 minavg 데이터 찾기"""
    s3 = boto3.client("s3", region_name=REGION)
    paginator = s3.get_paginator("list_objects_v2")
    
    year = target_time.strftime('%Y')
    month = target_time.strftime('%m')
    day = target_time.strftime('%d')
    hour = target_time.strftime('%H')
    minute = target_time.strftime('%M')
    
    # minavg 파일 경로 패턴: minavg/2025/08/14/13/202508141305_minavg.json
    target_pattern = f"{year}{month}{day}{hour}{minute}"
    
    print(f"[DEBUG] minavg 검색 패턴: {target_pattern}")
    
    for prefix_path in ["minavg/", "mintrend/"]:
        try:
            # 정확한 시간 폴더에서 검색
            search_prefix = f"{S3_PREFIX}{prefix_path}{year}/{month}/{day}/{hour}/"
            print(f"[DEBUG] minavg 검색 경로: {search_prefix}")
            
            pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 100})
            
            for page in pages:
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    filename = key.split('/')[-1]
                    
                    if filename.lower().endswith(".json") and target_pattern in filename:
                        print(f"[DEBUG] minavg 파일 매칭: {filename}")
                        try:
                            obj_data = s3.get_object(Bucket=S3_BUCKET_DATA, Key=key)
                            data = json.loads(obj_data['Body'].read().decode('utf-8'))
                            return {
                                'key': key,
                                'data': data,
                                'timestamp': target_time.strftime('%Y-%m-%d %H:%M:%S')
                            }
                        except Exception as e:
                            print(f"[DEBUG] minavg 파일 읽기 오류: {e}")
                            continue
        except Exception as e:
            print(f"[DEBUG] minavg 검색 오류: {e}")
            continue
    
    print(f"[DEBUG] minavg 데이터 없음, houravg fallback")
    # minavg를 찾지 못하면 houravg로 fallback
    return find_closest_sensor_data(target_time)

def find_closest_sensor_data(target_time: datetime) -> dict:
    """대상 시간에서 가장 가까운 센서 데이터 찾기"""
    s3 = boto3.client("s3", region_name=REGION)
    paginator = s3.get_paginator("list_objects_v2")
    
    closest_files = []
    
    # 대상 시간 기준으로 가장 가까운 시간부터 순차적으로 검색 (0, ±1, ±2, ±3...)
    for hours_diff in range(0, 73):  # 0~72시간(3일) 차이까지
        search_offsets = []
        if hours_diff == 0:
            search_offsets = [0]
        else:
            search_offsets = [-hours_diff, hours_diff]  # -3시간, +3시간 동시에 검색
            
        for hours_offset in search_offsets:
            search_time = target_time + timedelta(hours=hours_offset)
            year = search_time.strftime('%Y')
            month = search_time.strftime('%m') 
            day = search_time.strftime('%d')
            hour = search_time.strftime('%H')
            
            # houravg, minavg 순으로 검색 (시간 평균 우선)
            for prefix_path in ["houravg/", "minavg/"]:
                try:
                    search_prefix = f"{S3_PREFIX}{prefix_path}{year}/{month}/{day}/{hour}/"
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 200})
                    
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            if k.lower().endswith(".json"):
                                closest_files.append({
                                    'key': k,
                                    'last_modified': obj['LastModified'],
                                    'path_time': search_time
                                })
                    
                    # 첫 번째로 파일을 찾으면 중단 (가장 가까운 시간)
                    if closest_files:
                        break
                        
                except Exception as e:
                    pass
            
            # 파일을 찾았으면 더 이상 검색하지 않음
            if closest_files:
                break
        
        # 파일을 찾았으면 더 이상 검색하지 않음  
        if closest_files:
            break
    
    # 가장 가까운 시간의 파일 선택
    if closest_files:
        # 대상 시간에서 가장 가까운 파일 선택
        target_timestamp = int(target_time.strftime('%Y%m%d%H%M'))
        best_file = None
        min_time_diff = float('inf')
        
        for file_info in closest_files:
            filename = file_info['key'].split('/')[-1]
            if '_' in filename:
                file_timestamp_str = filename.split('_')[0]
                if len(file_timestamp_str) >= 12:
                    try:
                        file_timestamp = int(file_timestamp_str)
                        time_diff = abs(file_timestamp - target_timestamp)
                        if time_diff < min_time_diff:
                            min_time_diff = time_diff
                            best_file = file_info
                    except:
                        continue
        
        if best_file:
            try:
                obj = s3.get_object(Bucket=S3_BUCKET_DATA, Key=best_file['key'])
                data = json.loads(obj['Body'].read().decode('utf-8'))
                return {
                    'key': best_file['key'],
                    'data': data,
                    'timestamp': best_file['path_time'].strftime('%Y-%m-%d %H:%M:%S')
                }
            except Exception as e:
                pass
    
    return None

def retrieve_documents_from_s3(query: str, limit_chars: int = LIMIT_CONTEXT_CHARS, max_files: int = MAX_FILES_TO_SCAN, top_k: int = TOP_K, session=None):
    # 통합된 검색 로직: 요청된 시간에서 가장 가까운 데이터 찾기
    import re
    from datetime import datetime as datetime_cls
    
    print(f"[DEBUG] retrieve_documents_from_s3 시작: {query}")
    
    # 1) 시간 정보 추출
    dt_strings = extract_datetime_strings(query)
    print(f"[DEBUG] 추출된 시간 문자열: {dt_strings}")
    
    # UTF-8 문제로 인한 fallback 시간 추출
    if not dt_strings:
        # 간단한 패턴 매칭으로 날짜/시간 추출
        import re
        from datetime import datetime as datetime_cls
        
        # "8월 13일 오후 1시" 같은 패턴
        patterns = [
            r"(\d{1,2})월\s*(\d{1,2})일\s*오후\s*(\d{1,2})시",
            r"(\d{1,2})월\s*(\d{1,2})일\s*오전\s*(\d{1,2})시", 
            r"(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시",
            r"(\d{1,2})월\s*(\d{1,2})일"
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, query)
            for match in matches:
                try:
                    if len(match) == 4:  # 월, 일, 오전/오후, 시
                        month, day, ampm, hour = match
                        year = datetime_cls.now().year
                        h = int(hour)
                        if ampm == "오후" and h != 12:
                            h += 12
                        elif ampm == "오전" and h == 12:
                            h = 0
                        time_str = f"{year:04d}-{int(month):02d}-{int(day):02d} {h:02d}:00"
                        dt_strings.append(time_str)
                    elif len(match) == 3:  # 월, 일, 시 (24시간제)
                        month, day, hour = match
                        year = datetime_cls.now().year
                        time_str = f"{year:04d}-{int(month):02d}-{int(day):02d} {int(hour):02d}:00"
                        dt_strings.append(time_str)
                    elif len(match) == 2:  # 월, 일만
                        month, day = match
                        year = datetime_cls.now().year
                        time_str = f"{year:04d}-{int(month):02d}-{int(day):02d} 00:00"
                        dt_strings.append(time_str)
                except:
                    continue
    
    # 일간 평균 온도 요청 확인 (시간이 명시되지 않은 경우만)
    # 인코딩 문제를 피하기 위해 키워드 기반으로 검사 + 바이트 패턴 백업
    has_daily_keywords = ("평균" in query and "온도" in query and "일" in query)
    has_average_keywords = ("평균" in query and ("온도" in query or "temperature" in query))
    
    # 바이트 패턴으로 백업 검사 (한글 인코딩 문제 대응)
    try:
        query_bytes = query.encode('utf-8')
        has_daily_keywords_bytes = (b'\xed\x8f\x89\xea\xb7\xa0' in query_bytes and  # 평균
                                   b'\xec\x98\xa8\xeb\x8f\x84' in query_bytes and   # 온도
                                   b'\xec\x9d\xbc' in query_bytes)                  # 일
        has_average_keywords_bytes = (b'\xed\x8f\x89\xea\xb7\xa0' in query_bytes and  # 평균
                                     b'\xec\x98\xa8\xeb\x8f\x84' in query_bytes)      # 온도
    except:
        has_daily_keywords_bytes = False
        has_average_keywords_bytes = False
    
    # 두 방법 중 하나라도 성공하면 인정
    has_daily_keywords = has_daily_keywords or has_daily_keywords_bytes
    has_average_keywords = has_average_keywords or has_average_keywords_bytes
    
    print(f"[DEBUG] 일간 평균 키워드 검사: has_daily_keywords={has_daily_keywords}, has_average_keywords={has_average_keywords}")
    print(f"[DEBUG] 바이트 패턴 검사: has_daily_keywords_bytes={has_daily_keywords_bytes}, has_average_keywords_bytes={has_average_keywords_bytes}")
    
    # 특정 시간이 언급된 경우 일간 평균이 아님
    has_specific_time = bool(re.search(r"\d{1,2}\s*시|\d{1,2}\s*:\s*\d{1,2}|오전|오후", query))
    print(f"[DEBUG] has_specific_time: {has_specific_time}")
    
    is_daily_avg_query = (has_daily_keywords and not has_specific_time)
    print(f"[DEBUG] is_daily_avg_query: {is_daily_avg_query}")
    
    if is_daily_avg_query:
        print(f"[DEBUG] 일간 평균 쿼리 감지: {query}")
        daily_avg_data = calculate_daily_average_temperature(query)
        if daily_avg_data:
            print(f"[DEBUG] 일간 평균 데이터 찾음: {daily_avg_data['data_count']}시간, 평균 {daily_avg_data['average']}도")
            
            # 후속 질문용 컨텍스트 저장
            context_data = {
                "date": daily_avg_data['date'],
                "average": daily_avg_data['average'],
                "min": daily_avg_data['min'],
                "max": daily_avg_data['max']
            }
            print(f"[DEBUG] 일간평균 컨텍스트 저장: {context_data}")
            set_followup_context("daily_average", context_data, session)
            
            # 결과를 컨텍스트로 구성 (LLM이 이해하기 쉽게)
            context = f"[D1] {daily_avg_data['date']} 센서 데이터 분석 결과\n"
            context += f"일간 평균 온도: {daily_avg_data['average']}도\n"
            context += f"최저 온도: {daily_avg_data['min']}도\n"
            context += f"최고 온도: {daily_avg_data['max']}도\n"
            context += f"측정 시간 수: {daily_avg_data['data_count']}시간\n"
            context += f"해당 날짜의 온도 데이터가 정상적으로 수집되었습니다.\n"
            
            top_doc = {
                'score': 100,
                'schema': 'daily_average',
                'content': context,
                'id': f"daily_avg_{daily_avg_data['date']}",
                'tag': 'D1'
            }
            
            return [top_doc], context
    
    # 범위 쿼리 확인
    time_range = extract_time_range_from_query(query)
    if time_range:
        print(f"[DEBUG] 범위 쿼리 감지: {time_range}")
        
        # 범위 쿼리의 시작/끝 시간을 파싱하여 컨텍스트 저장
        if len(time_range) >= 2:
            from datetime import datetime as datetime_cls
            try:
                start_time_str = time_range[0]
                end_time_str = time_range[1]
                
                # 시간 파싱
                start_time = None
                end_time = None
                
                # "13시", "15시" 형태의 시간 파싱
                start_hour_match = re.search(r'(\d{1,2})\s*시', start_time_str)
                end_hour_match = re.search(r'(\d{1,2})\s*시', end_time_str)
                
                if start_hour_match and end_hour_match:
                    start_hour = int(start_hour_match.group(1))
                    end_hour = int(end_hour_match.group(1))
                    
                    # 오늘 날짜로 기준 설정 (실제 날짜 파싱은 나중에 개선 가능)
                    base_date = datetime_cls.now().replace(hour=0, minute=0, second=0, microsecond=0)
                    start_time = base_date.replace(hour=start_hour)
                    end_time = base_date.replace(hour=end_hour)
                    
                    # 후속 질문용 컨텍스트 저장
                    context_data = {
                        "start_time": start_time,
                        "end_time": end_time,
                        "range_text": f"{start_hour}시부터 {end_hour}시까지"
                    }
                    print(f"[DEBUG] 범위 컨텍스트 저장: {context_data}")
                    set_followup_context("time_range", context_data, session)
            except Exception as e:
                print(f"[DEBUG] 범위 시간 파싱 오류: {e}")
        
        dt_strings = time_range  # 범위 쿼리면 범위로 교체
    
    offset_value, offset_unit = extract_time_offset(query)
    
    # 2) 대상 시간 계산
    target_dt = None
    
    if offset_value and offset_unit:
        # 상대적 시간 (3시간 전, 어제 등)
        now = datetime_cls.now()
        if offset_unit == 'minute':
            target_dt = now - timedelta(minutes=offset_value)
        elif offset_unit == 'hour':
            target_dt = now - timedelta(hours=offset_value)
        elif offset_unit == 'day':
            # 상대적 날짜 + 시간 조합 처리 (예: "어제 17시")
            base_dt = now - timedelta(days=offset_value)
            
            # 쿼리에서 시간 정보 추출 시도
            # 오전/오후 패턴 먼저 확인
            ampm_match = re.search(r'(오전|오후)\s*(\d{1,2})\s*시', query)
            hour_match = re.search(r'(\d{1,2})\s*시', query)
            minute_match = re.search(r'(\d{1,2})\s*분', query)
            
            if ampm_match:
                ampm = ampm_match.group(1)
                hour = int(ampm_match.group(2))
                minute = int(minute_match.group(1)) if minute_match else 0
                
                # 오전/오후 처리
                if ampm == "오후" and hour != 12:
                    hour += 12
                elif ampm == "오전" and hour == 12:
                    hour = 0
                    
                target_dt = base_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
            elif hour_match:
                hour = int(hour_match.group(1))
                minute = int(minute_match.group(1)) if minute_match else 0
                # 어제의 해당 시간으로 설정
                target_dt = base_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
            else:
                # 시간 정보가 없으면 해당 날짜의 현재 시간
                target_dt = base_dt
    elif dt_strings and len(dt_strings) > 1:
        # 복수 시간 처리 (범위 쿼리 등)
        print(f"[DEBUG] 복수 시간 감지, 각 시간별로 granularity 기반 검색: {dt_strings}")
        
        # 가장 구체적인 시간이 있으면 단일 시간으로 처리 (예: "13시 5분"의 경우)
        gran = requested_granularity(query)
        if gran == "minute":
            # 분 단위 질의의 경우 가장 구체적인 시간(분이 포함된) 하나만 사용
            specific_times = [dt for dt in dt_strings if ':05' in dt or ':0' in dt and dt != dt_strings[-1]]  # 00:00 제외
            if specific_times:
                print(f"[DEBUG] 분 단위 질의로 단일 시간 처리로 전환: {specific_times[0]}")
                target_dt = parse_dt(specific_times[0])
                if target_dt:
                    print(f"[DEBUG] minavg 직접 검색: {target_dt}")
                    closest_data = find_minavg_data(target_dt)
                    
                    if closest_data:
                        data = closest_data['data']
                        is_minavg = 'minavg' in closest_data['key'] or 'mintrend' in closest_data['key']
                        
                        if is_minavg:
                            content = f"분별 측정 센서 데이터:\n"
                            if 'mintemp' in data:
                                content += f"온도: {data['mintemp']}도\n"
                            if 'minhum' in data:
                                content += f"습도: {data['minhum']}%\n"
                            if 'mingas' in data:
                                content += f"이산화탄소: {data['mingas']}ppm\n"
                        else:
                            content = json.dumps(data, ensure_ascii=False, indent=2)
                        
                        top_doc = {
                            'score': 100,
                            'schema': 'minavg' if is_minavg else 'closest',
                            'content': content,
                            'id': closest_data['key'],
                            'tag': 'D1'
                        }
                        
                        timestamp_str = data.get('timestamp', '')
                        if timestamp_str:
                            try:
                                dt = datetime_cls.fromisoformat(timestamp_str.replace('T', ' '))
                                korean_time = f"{dt.year}년 {dt.month}월 {dt.day}일 {dt.hour}시 {dt.minute}분"
                            except:
                                korean_time = timestamp_str
                        else:
                            korean_time = "시간 정보 없음"
                        
                        context = f"[D1] {korean_time} 분별 측정 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}\n"
                        return [top_doc], context
        
        target_dts = []
        for ds in dt_strings:
            dt = parse_dt(ds)
            if dt:
                target_dts.append(dt)
        
        if target_dts:
            # 각 시간에 대해 granularity 기반 검색
            gran = requested_granularity(query)
            print(f"[DEBUG] 복수 시간 granularity: {gran}")
            
            all_docs = []
            context_parts = []
            
            for i, target_dt in enumerate(target_dts):
                print(f"[DEBUG] 시간 {i+1}/{len(target_dts)} 검색: {target_dt}")
                
                # 각 시간에 대해 granularity별 검색
                if gran == "hour":
                    # houravg 검색 (기존 함수는 houravg 우선이므로 사용)
                    closest_data = find_closest_sensor_data(target_dt)
                else:
                    # minavg 검색 - 직접 구현
                    print(f"[DEBUG] minavg 직접 검색: {target_dt}")
                    closest_data = find_minavg_data(target_dt)
                
                if closest_data:
                    tag = f"D{i+1}"
                    data = closest_data['data']
                    
                    # 데이터 타입 확인
                    is_houravg = 'hourtemp' in data or 'houravg' in closest_data['key']
                    is_minavg = 'minavg' in closest_data['key'] or 'mintrend' in closest_data['key']
                    
                    if is_minavg:
                        # minavg 데이터용 특별 포맷
                        content = f"분별 측정 센서 데이터:\n"
                        if 'mintemp' in data:
                            content += f"온도: {data['mintemp']}도\n"
                        if 'minhum' in data:
                            content += f"습도: {data['minhum']}%\n"
                        if 'mingas' in data:
                            content += f"이산화탄소: {data['mingas']}ppm\n"
                        
                        top_doc = {
                            'score': 100 - i,
                            'schema': 'minavg',
                            'content': content,
                            'id': closest_data['key'],
                            'tag': tag
                        }
                    elif is_houravg:
                        # houravg 데이터용 특별 포맷 (LLM이 확실히 인식하도록 강화)
                        content = f"이것은 해당 시간대 전체의 평균값입니다.\n"
                        content += f"시간별 평균 센서 데이터:\n"
                        if 'hourtemp' in data:
                            content += f"⭐ 시간별 평균 온도: {data['hourtemp']}도 (60분간 평균)\n"
                        if 'hourhum' in data:
                            content += f"⭐ 시간별 평균 습도: {data['hourhum']}% (60분간 평균)\n"
                        if 'hourgas' in data:
                            content += f"⭐ 시간별 평균 이산화탄소: {data['hourgas']}ppm (60분간 평균)\n"
                        
                        top_doc = {
                            'score': 100 - i,
                            'schema': 'houravg',
                            'content': content,
                            'id': closest_data['key'],
                            'tag': tag
                        }
                    else:
                        # 일반 데이터용 포맷
                        top_doc = {
                            'score': 100 - i,
                            'schema': 'closest',
                            'content': json.dumps(data, ensure_ascii=False, indent=2),
                            'id': closest_data['key'],
                            'tag': tag
                        }
                    
                    all_docs.append(top_doc)
                    
                    # 타임스탬프를 한국어로 변환
                    timestamp_str = data.get('timestamp', '')
                    if timestamp_str:
                        try:
                            dt = datetime_cls.fromisoformat(timestamp_str.replace('T', ' '))
                            korean_time = f"{dt.year}년 {dt.month}월 {dt.day}일 {dt.hour}시"
                        except:
                            korean_time = timestamp_str
                    else:
                        korean_time = "시간 정보 없음"
                    
                    if is_houravg:
                        context_parts.append(f"[{tag}] {korean_time} 시간별 평균 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}")
                    elif is_minavg:
                        context_parts.append(f"[{tag}] {korean_time} 분별 측정 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}")
                    else:
                        context_parts.append(f"[{tag}] {korean_time} 측정 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}")
            
            if all_docs:
                context = "\n\n".join(context_parts) + "\n"
                return all_docs, context
    elif dt_strings:
        # 단일 시간 처리
        print(f"[DEBUG] 단일 시간 처리: {dt_strings}")
        
        target_dt = parse_dt(dt_strings[0])
        if target_dt:
            gran = requested_granularity(query)
            print(f"[DEBUG] 단일 시간 granularity: {gran}")
            print(f"[DEBUG] 단일 시간 검색: {target_dt}")
            
            # granularity별 검색
            if gran == "hour":
                closest_data = find_closest_sensor_data(target_dt)
            else:
                closest_data = find_minavg_data(target_dt)
            
            if closest_data:
                data = closest_data['data']
                
                # 데이터 타입 확인 및 포맷
                is_houravg = 'hourtemp' in data or 'houravg' in closest_data['key']
                is_minavg = 'minavg' in closest_data['key'] or 'mintrend' in closest_data['key']
                
                if is_minavg:
                    content = f"분별 측정 센서 데이터:\n"
                    if 'mintemp' in data:
                        content += f"온도: {data['mintemp']}도\n"
                    if 'minhum' in data:
                        content += f"습도: {data['minhum']}%\n"
                    if 'mingas' in data:
                        content += f"이산화탄소: {data['mingas']}ppm\n"
                    
                    top_doc = {
                        'score': 100,
                        'schema': 'minavg',
                        'content': content,
                        'id': closest_data['key'],
                        'tag': 'D1'
                    }
                elif is_houravg:
                    content = f"이것은 해당 시간대 전체의 평균값입니다.\n"
                    content += f"시간별 평균 센서 데이터:\n"
                    if 'hourtemp' in data:
                        content += f"⭐ 시간별 평균 온도: {data['hourtemp']}도 (60분간 평균)\n"
                    if 'hourhum' in data:
                        content += f"⭐ 시간별 평균 습도: {data['hourhum']}% (60분간 평균)\n"
                    if 'hourgas' in data:
                        content += f"⭐ 시간별 평균 이산화탄소: {data['hourgas']}ppm (60분간 평균)\n"
                    
                    top_doc = {
                        'score': 100,
                        'schema': 'houravg',
                        'content': content,
                        'id': closest_data['key'],
                        'tag': 'D1'
                    }
                else:
                    top_doc = {
                        'score': 100,
                        'schema': 'closest',
                        'content': json.dumps(data, ensure_ascii=False, indent=2),
                        'id': closest_data['key'],
                        'tag': 'D1'
                    }
                
                # 타임스탬프를 한국어로 변환
                timestamp_str = data.get('timestamp', '')
                if timestamp_str:
                    try:
                        dt = datetime_cls.fromisoformat(timestamp_str.replace('T', ' '))
                        korean_time = f"{dt.year}년 {dt.month}월 {dt.day}일 {dt.hour}시"
                    except:
                        korean_time = timestamp_str
                else:
                    korean_time = "시간 정보 없음"
                
                if is_houravg:
                    context = f"[D1] {korean_time} 시간별 평균 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}\n"
                elif is_minavg:
                    context = f"[D1] {korean_time} 분별 측정 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}\n"
                else:
                    context = f"[D1] {korean_time} 측정 데이터 (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{top_doc['content']}\n"
                return [top_doc], context
    else:
        # 시간 정보 없음 → 최근 데이터
        target_dt = datetime_cls.now()
    
    # 3) 단일 시간 검색 - granularity 기반 검색 후 fallback으로 이동
    # (granularity 기반 검색을 먼저 시도하도록 주석 처리)
    
    # 4) 시간 기반 검색 실패 시 기존 방식으로 fallback
    dt_strings = extract_datetime_strings(query)
    target_dt = None
    date_prefixes = []
    
    # 상대 시간 쿼리의 경우 계산된 target_dt 사용
    if offset_value and offset_unit and not target_dt:
        if offset_unit == 'minute':
            target_dt = datetime_cls.now() - timedelta(minutes=offset_value)
        elif offset_unit == 'hour':
            target_dt = datetime_cls.now() - timedelta(hours=offset_value)
        elif offset_unit == 'day':
            target_dt = datetime_cls.now() - timedelta(days=offset_value)
        
        if target_dt:
            date_prefix = target_dt.strftime('%Y%m%d')
            date_prefixes.append(date_prefix)
    
    # 쿼리에서 날짜 추출 (상대 시간이 아닌 경우)
    if not date_prefixes:
        for ds in dt_strings:
            dt = parse_dt(ds)
            if dt:
                target_dt = dt
                date_prefix = dt.strftime('%Y%m%d')  # YYYYMMDD 형식
                date_prefixes.append(date_prefix)
                break
    
    gran = requested_granularity(query)
    print(f"[DEBUG] 결정된 granularity: {gran}")
    print(f"[DEBUG] target_dt: {target_dt}")
    print(f"[DEBUG] date_prefixes: {date_prefixes}")
    
    paginator = s3.get_paginator("list_objects_v2")
    priority_keys = []
    
    # 날짜가 명시된 경우 해당 날짜 폴더만 검색
    if date_prefixes:
        date_prefix = date_prefixes[0]
        
        if gran == "hour":
            # 시간 질의: 매우 제한적으로 해당 시간 파일만 검색
            hour_prefix = target_dt.strftime('%H') if target_dt else ""
            
            for prefix_path in ["houravg/", "hourtrend/"]:  # houravg 우선
                try:
                    # 날짜별 폴더 시도
                    search_prefix = f"{S3_PREFIX}{prefix_path}{date_prefix}/"
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 100})
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            if k.lower().endswith(".json"):
                                # 정확한 시간 매칭 우선
                                if hour_prefix and hour_prefix in k:
                                    priority_keys.insert(0, k)  # 정확한 매칭은 맨 앞에
                                else:
                                    priority_keys.append(k)
                            if len(priority_keys) >= 50:  # 더 많이 검색
                                break
                        if len(priority_keys) >= 50:
                            break
                except Exception as e:
                    pass
                
                # 날짜별 폴더가 없으면 전체 폴더에서 날짜 매칭 시도
                if len(priority_keys) == 0:
                    try:
                        search_prefix = f"{S3_PREFIX}{prefix_path}"
                        pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 200})
                        for page in pages:
                            for obj in page.get("Contents", []):
                                k = obj["Key"]
                                if k.lower().endswith(".json") and date_prefix in k:
                                    # 정확한 시간 매칭 우선
                                    if hour_prefix and hour_prefix in k:
                                        priority_keys.insert(0, k)
                                    else:
                                        priority_keys.append(k)
                                if len(priority_keys) >= 30:
                                    break
                            if len(priority_keys) >= 30:
                                break
                    except Exception as e:
                        pass
        elif gran == "minute":
            # 분 질의: 정확한 시간 폴더에서 검색
            hour_prefix = target_dt.strftime('%H') if target_dt else ""
            minute_prefix = target_dt.strftime('%M') if target_dt else ""
            
            # 폴더 경로: minavg/2025/08/11/14/
            year = target_dt.strftime('%Y') if target_dt else "2025"
            month = target_dt.strftime('%m') if target_dt else ""
            day = target_dt.strftime('%d') if target_dt else ""
            
            target_datetime = f"{date_prefix}{hour_prefix}{minute_prefix}"  # 202508111401
            print(f"[DEBUG] minavg 검색 시작: 타겟시간={target_datetime}, 날짜={date_prefix}")
            
            for prefix_path in ["minavg/", "mintrend/"]:
                try:
                    # 정확한 시간 폴더에서 검색: minavg/2025/08/11/14/
                    search_prefix = f"{S3_PREFIX}{prefix_path}{year}/{month}/{day}/{hour_prefix}/"
                    print(f"[DEBUG] minavg 폴더 검색: {search_prefix}")
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 100})
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            filename = k.split('/')[-1]  # 파일명만 추출
                            if filename.lower().endswith(".json"):
                                print(f"[DEBUG] minavg 파일 발견: {filename}")
                                # 정확한 분 매칭 우선
                                if target_datetime in filename:
                                    print(f"[DEBUG] 정확한 매칭! {target_datetime} in {filename}")
                                    priority_keys.insert(0, k)
                                else:
                                    priority_keys.append(k)
                            if len(priority_keys) >= 30:
                                break
                        if len(priority_keys) >= 30:
                            break
                except Exception as e:
                    print(f"[DEBUG] minavg 검색 오류: {e}")
                    pass
            
            print(f"[DEBUG] minavg 검색 완료: 총 {len(priority_keys)}개 파일 발견")
            
            # 정확한 시간 폴더에서 못 찾으면 전체 폴더에서 fallback
            if len(priority_keys) == 0:
                for prefix_path in ["minavg/", "mintrend/"]:
                    try:
                        search_prefix = f"{S3_PREFIX}{prefix_path}"
                        pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 200})
                        for page in pages:
                            for obj in page.get("Contents", []):
                                k = obj["Key"]
                                filename = k.split('/')[-1]
                                if filename.lower().endswith(".json") and target_datetime in filename:
                                    priority_keys.insert(0, k)
                                if len(priority_keys) >= 10:
                                    break
                            if len(priority_keys) >= 10:
                                break
                    except Exception as e:
                        pass
        
        # rawdata는 검색하지 않음 - 평균 데이터만 사용
        
        # 분 데이터가 부정확하거나 해당 시간대 데이터가 없으면 시간 데이터로 fallback
        if gran == "minute":
            # 정확한 시분 매칭이 없거나, 다른 시간대 데이터만 있는 경우
            exact_matches = [k for k in priority_keys if f"{date_prefix}{hour_prefix}{minute_prefix}" in k]
            same_hour_matches = [k for k in priority_keys if f"{date_prefix}{hour_prefix}" in k and f"{date_prefix}{hour_prefix}{minute_prefix}" not in k]
            
            if len(exact_matches) == 0:  # 정확한 매칭이 없으면
                priority_keys = []  # 기존 부정확한 데이터 제거
                
                for prefix_path in ["houravg/", "hourtrend/"]:
                    try:
                        search_prefix = f"{S3_PREFIX}{prefix_path}{date_prefix}/"
                        pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 100})
                        for page in pages:
                            for obj in page.get("Contents", []):
                                k = obj["Key"]
                                if k.lower().endswith(".json"):
                                    target_hour_pattern = f"{date_prefix}{hour_prefix}"  # 202508111
                                    if target_hour_pattern in k:
                                        priority_keys.insert(0, k)
                                    elif date_prefix in k:
                                        priority_keys.append(k)
                                if len(priority_keys) >= 30:
                                    break
                            if len(priority_keys) >= 30:
                                break
                    except Exception as e:
                        pass
                
                # 날짜별 폴더에서 못 찾으면 전체 폴더에서 시도
                if len(priority_keys) == 0:
                    for prefix_path in ["houravg/", "hourtrend/"]:
                        try:
                            search_prefix = f"{S3_PREFIX}{prefix_path}"
                            pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 200})
                            for page in pages:
                                for obj in page.get("Contents", []):
                                    k = obj["Key"]
                                    if k.lower().endswith(".json"):
                                        target_hour_pattern = f"{date_prefix}{hour_prefix}"  # 202508111
                                        if target_hour_pattern in k:
                                            priority_keys.insert(0, k)
                                        elif date_prefix in k:
                                            priority_keys.append(k)
                                    if len(priority_keys) >= 30:
                                        break
                                if len(priority_keys) >= 30:
                                    break
                        except Exception as e:
                            pass
        
        # 평균 데이터만 사용하므로 전체 검색 불필요
        keys = priority_keys[:100]  # 더 많은 평균 데이터 검색
    else:
        # 날짜가 명시되지 않은 경우 - 평균 데이터만 검색
        if gran == "hour":
            for prefix_path in ["houravg/", "hourtrend/"]:  # houravg 우선
                try:
                    search_prefix = S3_PREFIX + prefix_path
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 100})
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            if k.lower().endswith(".json"):
                                priority_keys.append(k)
                            if len(priority_keys) >= 80:
                                break
                        if len(priority_keys) >= 80:
                            break
                except Exception:
                    pass
        elif gran == "minute":
            for prefix_path in ["minavg/", "mintrend/"]:
                try:
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX + prefix_path, PaginationConfig={'MaxItems': 100})
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            if k.lower().endswith(".json"):
                                priority_keys.append(k)
                            if len(priority_keys) >= 80:
                                break
                        if len(priority_keys) >= 80:
                            break
                except Exception:
                    pass
        else:
            # granularity가 명확하지 않으면 시간 평균 데이터 기본 검색
            for prefix_path in ["houravg/", "hourtrend/"]:
                try:
                    search_prefix = S3_PREFIX + prefix_path
                    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 80})
                    for page in pages:
                        for obj in page.get("Contents", []):
                            k = obj["Key"]
                            if k.lower().endswith(".json"):
                                priority_keys.append(k)
                            if len(priority_keys) >= 60:
                                break
                        if len(priority_keys) >= 60:
                            break
                except Exception:
                    pass
        
        # 평균 데이터만 사용
        keys = priority_keys[:80]
    
    # 평균 데이터만 사용
    all_keys = keys[:max_files]

    # 마지막 fallback: 상대 시간 쿼리에서 데이터가 없으면 주변 날짜에서 검색
    if not all_keys and offset_value and offset_unit:
        print(f"[Fallback] 대상 날짜({target_dt.strftime('%Y-%m-%d') if target_dt else 'N/A'})에 데이터가 없어 주변 날짜에서 검색합니다.")
        
        # 대상 시간 주변 ±3일 범위에서 검색
        fallback_keys = []
        for days_offset in range(-3, 4):  # -3일부터 +3일까지
            if target_dt:
                search_date = target_dt + timedelta(days=days_offset)
                search_date_prefix = search_date.strftime('%Y%m%d')
                
                # minavg와 houravg에서 해당 날짜 검색
                for prefix_path in ["minavg/", "houravg/"]:
                    try:
                        year = search_date.strftime('%Y')
                        month = search_date.strftime('%m')
                        day = search_date.strftime('%d')
                        
                        search_prefix = f"{S3_PREFIX}{prefix_path}{year}/{month}/{day}/"
                        pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=search_prefix, PaginationConfig={'MaxItems': 50})
                        
                        for page in pages:
                            for obj in page.get("Contents", []):
                                k = obj["Key"]
                                if k.lower().endswith(".json"):
                                    fallback_keys.append(k)
                                if len(fallback_keys) >= 20:
                                    break
                            if len(fallback_keys) >= 20:
                                break
                        
                        if len(fallback_keys) >= 10:  # 충분한 데이터를 찾으면 중단
                            break
                            
                    except Exception as e:
                        pass
                
                if len(fallback_keys) >= 10:
                    break
        
        if fallback_keys:
            all_keys = fallback_keys[:max_files]
            print(f"[Fallback] {len(all_keys)}개의 대체 데이터를 찾았습니다.")
        
    # minavg 검색이 실패한 경우 find_closest_sensor_data로 fallback
    if not all_keys and gran == "minute" and target_dt:
        print(f"[Fallback] minavg 검색 실패 (찾은 키: {len(priority_keys)}개), 가장 가까운 센서 데이터를 찾습니다...")
        closest_data = find_closest_sensor_data(target_dt)
        if closest_data:
            # closest_data를 문서 형태로 변환
            content = f"가장 가까운 센서 데이터 (요청 시간: {target_dt.strftime('%Y-%m-%d %H:%M')}):\n"
            content += f"실제 데이터 시간: {closest_data['timestamp']}\n"
            data = closest_data.get('data', {})
            if 'temperature' in data:
                content += f"온도: {data['temperature']}도\n"
            if 'humidity' in data:
                content += f"습도: {data['humidity']}%\n"
            if 'gas' in data:
                content += f"공기질(가스): {data['gas']}ppm\n"
            
            top_doc = {
                'score': 100,
                'schema': 'closest_sensor',
                'content': content,
                'id': closest_data['key'],
                'tag': 'D1'
            }
            context = f"[D1] (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{content}\n"
            return [top_doc], context
    
    # 모든 검색이 실패한 경우 최종 fallback
    if not all_keys and target_dt:
        print(f"[Final Fallback] 모든 검색 실패, find_closest_sensor_data로 최종 시도...")
        closest_data = find_closest_sensor_data(target_dt)
        if closest_data:
            # closest_data를 문서 형태로 변환
            content = f"가장 가까운 센서 데이터 (요청 시간: {target_dt.strftime('%Y-%m-%d %H:%M')}):\n"
            content += f"실제 데이터 시간: {closest_data['timestamp']}\n"
            data = closest_data.get('data', {})
            if 'temperature' in data:
                content += f"온도: {data['temperature']}도\n"
            if 'humidity' in data:
                content += f"습도: {data['humidity']}%\n"
            if 'gas' in data:
                content += f"공기질(가스): {data['gas']}ppm\n"
            
            top_doc = {
                'score': 100,
                'schema': 'closest_sensor',
                'content': content,
                'id': closest_data['key'],
                'tag': 'D1'
            }
            context = f"[D1] (s3://{S3_BUCKET_DATA}/{closest_data['key']})\n{content}\n"
            return [top_doc], context

    if not all_keys: 
        return [], ""

    scored = []
    with _f.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_key = {executor.submit(download_and_score_file, key, query): key for key in all_keys}
        for future in _f.as_completed(future_to_key):
            result = future.result()
            if result: scored.append(result)

    if not scored: return [], ""

    top = sorted(scored, key=lambda x: x["score"], reverse=True)[:top_k]

    # 컨텍스트(LLM 백업용)
    parts, context_length = [], 0
    for idx, d in enumerate(top, start=1):
        tag = f"D{idx}"; d["tag"] = tag
        remaining_space = limit_chars - context_length - 200
        if remaining_space <= 0: break
        content = d["content"]
        if len(content) > remaining_space:
            content = content[:remaining_space] + "\n[문서가 길어 일부만 표시됩니다...]"
        part = f"[{tag}] (s3://{S3_BUCKET_DATA}/{d['id']})\n{content}\n"
        parts.append(part)
        context_length += len(part)

    context = "\n---\n".join(parts).strip()
    return top, context

# ===== 통계/추이/윈도우 유틸 =====
def select_rows_in_range(rows, start_dt, end_dt):
    return [r for r in rows if start_dt <= r["timestamp"] <= end_dt]

def select_rows_in_minute(rows, dt_minute: datetime):
    m_start = dt_minute.replace(second=0)
    m_end = m_start + timedelta(minutes=1) - timedelta(seconds=1)
    return [r for r in rows if m_start <= r["timestamp"] <= m_end], m_start, m_end

def select_rows_in_hour(rows, dt_hour: datetime):
    h_start = dt_hour.replace(minute=0, second=0)
    h_end = h_start + timedelta(hours=1) - timedelta(seconds=1)
    return [r for r in rows if h_start <= r["timestamp"] <= h_end], h_start, h_end

def select_rows_in_day(rows, dt_day: datetime):
    d_start = dt_day.replace(hour=0, minute=0, second=0)
    d_end = d_start + timedelta(days=1) - timedelta(seconds=1)
    return [r for r in rows if d_start <= r["timestamp"] <= d_end], d_start, d_end

def compute_stats(rows):
    if not rows: return None
    keys = set().union(*[set(r.keys()) for r in rows]) - {"timestamp"}
    out = {}
    for k in ["temperature","humidity","gas"]:
        if k in keys:
            arr = [r[k] for r in rows if k in r]
            if arr:
                out[k] = {"avg": sum(arr)/len(arr), "min": min(arr), "max": max(arr), "first": arr[0], "last": arr[-1]}
    return out

def compare_trend(curr_stat, prev_stat):
    def diff_pct(a, b):
        if b is None or a is None or b == 0: return None
        return (a - b) / b * 100.0
    out = {}
    for field in ["temperature", "humidity", "gas"]:
        cs = curr_stat.get(field) if curr_stat else None
        ps = prev_stat.get(field) if prev_stat else None
        if not cs or not ps: out[field] = None; continue
        base_curr = cs.get("avg") if cs.get("avg") is not None else cs.get("last")
        base_prev = ps.get("avg") if ps.get("avg") is not None else ps.get("last")
        if base_curr is None or base_prev is None:
            out[field] = None; continue
        delta = base_curr - base_prev
        pct = diff_pct(base_curr, base_prev)
        out[field] = {"delta": delta, "pct": pct}
    return out

def fmt_trend_line(field_kor, stat, trend):
    if not stat: return f"{field_kor}: 데이터 없음"
    avg_s = f"평균 {stat['avg']:.3f}, 범위 [{stat['min']:.3f}~{stat['max']:.3f}]"
    if not trend: return f"{field_kor}: {avg_s}"
    delta = trend["delta"]; pct = trend["pct"]
    if delta is None: return f"{field_kor}: {avg_s}"
    dir_word = "증가" if delta > 0 else ("감소" if delta < 0 else "변화 없음")
    pct_s = f"{pct:+.2f}%" if pct is not None else "N/A"
    return f"{field_kor}: {avg_s} | 직전 구간 대비 {dir_word} ({delta:+.3f}, {pct_s})"

def filter_fields(row: dict, need_fields: set):
    if not need_fields:
        return {k: row[k] for k in ["temperature","humidity","gas"] if k in row}
    return {f: row[f] for f in need_fields if f in row}

def format_point_answer(values: dict, ts: datetime, tag="D1"):
    parts = []
    for k in ["temperature", "humidity", "gas"]:
        if k in values:
            name = FIELD_NAME_KOR.get(k, k)
            value = values[k]
            parts.append(f"{name} **{value}**")
    
    if not parts:
        body = "데이터가 없습니다."
    elif len(parts) == 1:
        body = f"해당 시점의 {parts[0]}"
    else:
        body = f"📊 **정확한 시점 데이터**\n" + "\n".join([f"• {part}" for part in parts])
    
    return f"{ts.strftime('%Y-%m-%d %H:%M:%S')} 기준:\n{body} [{tag}]"

def format_window_answer(rows_in_window, w_start, w_end, need_fields, tag="D1", window_name="구간", show_samples=True):
    fields = list(need_fields) if need_fields else [k for k in ["temperature","humidity","gas"] if any(k in r for r in rows_in_window)]
    name_map = FIELD_NAME_KOR
    lines = [f"[{window_name}] {w_start.strftime('%Y-%m-%d %H:%M:%S')} ~ {w_end.strftime('%Y-%m-%d %H:%M:%S')}"]
    for f in fields:
        arr = [r[f] for r in rows_in_window if f in r]
        if arr:
            a = sum(arr)/len(arr)
            lines.append(f"{name_map.get(f,f)} 평균: {a:.3f}")
        else:
            lines.append(f"{name_map.get(f,f)} 평균: 데이터 없음")
    if show_samples:
        lines.append(f"[{window_name} 데이터 {len(rows_in_window)}개]")
        for r in rows_in_window:
            parts = []
            if "temperature" in fields and "temperature" in r: parts.append(f"T={r['temperature']}")
            if "humidity" in fields and "humidity" in r:    parts.append(f"H={r['humidity']}")
            if "gas" in fields and "gas" in r:               parts.append(f"CO2={r['gas']}")
            lines.append(f"{r['timestamp'].strftime('%Y-%m-%d %H:%M:%S')} | " + ", ".join(parts))
    else:
        lines.append(f"(샘플 {len(rows_in_window)}개는 생략됨 — '상세' 또는 '원본'이라고 물으면 전부 보여줄게)")
    return "\n".join(lines) + f" [{tag}]"

# ===== RAW 변환 =====
def _load_raw_rows(j):
    rows = []
    # rawdata: 리스트 형태
    if isinstance(j, list):
        for i, r in enumerate(j):
            try:
                ts = parse_dt(str(r["timestamp"]))
                if not ts: continue
                temperature = float(r["temperature"]) if "temperature" in r else float(r["temp"])
                humidity    = float(r["humidity"]) if "humidity" in r else float(r["hum"])
                gas         = float(r["gas"])
                rows.append({"timestamp": ts, "temperature": temperature, "humidity": humidity, "gas": gas})
            except Exception:
                continue
    # 단일 항목 데이터들을 행으로 변환
    elif isinstance(j, dict):
        try:
            # houravg 형태 (hourtemp, hourhum, hourgas)
            if "hourtemp" in j:
                ts = parse_dt(str(j["timestamp"]))
                if ts:
                    rows.append({
                        "timestamp": ts,
                        "temperature": float(j["hourtemp"]),
                        "humidity": float(j["hourhum"]),
                        "gas": float(j["hourgas"])
                    })
            # minavg 형태 (mintemp, minhum, mingas)
            elif "mintemp" in j:
                ts = parse_dt(str(j["timestamp"]))
                if ts:
                    rows.append({
                        "timestamp": ts,
                        "temperature": float(j["mintemp"]),
                        "humidity": float(j["minhum"]),
                        "gas": float(j["mingas"])
                    })
            # mintrend 형태 (data 안에 있음)
            elif "data" in j and "mintemp" in j["data"]:
                data = j["data"]
                ts = parse_dt(str(data["timestamp"]))
                if ts:
                    rows.append({
                        "timestamp": ts,
                        "temperature": float(data["mintemp"]),
                        "humidity": float(data["minhum"]),
                        "gas": float(data["mingas"])
                    })
        except Exception:
            pass
    
    rows.sort(key=lambda x: x["timestamp"])
    return rows

# ====== 마지막 센서 질의 컨텍스트 ======
LAST_SENSOR_CTX: Dict[str, object] = {
    "window": None,  # "second" | "minute" | "hour" | "range" | None
    "start": None,   # datetime
    "end": None,     # datetime
    "rows": None,    # List[dict] (RAW rows)
    "tag": None,     # "D1" 등
    "label": None    # "해당 분" 등
}

def _reset_last_ctx(session=None):
    if session:
        session.clear_last_sensor_ctx()
    else:
        LAST_SENSOR_CTX.update({"window": None, "start": None, "end": None, "rows": None, "tag": None, "label": None})

def _set_last_ctx(window: str, start: datetime, end: datetime, rows: List[dict], tag: str, label: str, session=None):
    if session:
        session.update_last_sensor_ctx(window, start, end, rows, tag, label)
    else:
        LAST_SENSOR_CTX["window"] = window
        LAST_SENSOR_CTX["start"] = start
        LAST_SENSOR_CTX["end"] = end
        LAST_SENSOR_CTX["rows"] = rows
        LAST_SENSOR_CTX["tag"] = tag
        LAST_SENSOR_CTX["label"] = label

def _get_last_ctx(session=None):
    if session:
        return session.last_sensor_ctx
    else:
        return LAST_SENSOR_CTX

def _format_full_rows(rows: List[dict], start: datetime, end: datetime, tag: str, label: str) -> str:
    lines = [f"[{label} 상세] {start.strftime('%Y-%m-%d %H:%M:%S')} ~ {end.strftime('%Y-%m-%d %H:%M:%S')} | 샘플 {len(rows)}개"]
    for r in rows:
        t = r["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        parts = []
        if "temperature" in r: parts.append(f"T={r['temperature']}")
        if "humidity" in r:    parts.append(f"H={r['humidity']}")
        if "gas" in r:         parts.append(f"CO2={r['gas']}")
        lines.append(f"{t} | " + ", ".join(parts))
    return "\n".join(lines) + f" [{tag}]"

# ---- RAW 전체 재수집/정확 매칭 ----
def fetch_raw_rows_for_window_all(start: datetime, end: datetime, max_files: int = MAX_FILES_TO_SCAN) -> Tuple[List[dict], Optional[str]]:
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX)

    keys = []
    for page in pages:
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if not k.lower().endswith(".json"):
                continue
            keys.append(k)
            if len(keys) >= max_files:
                break
        if len(keys) >= max_files:
            break

    all_rows = []
    raw_tag = None
    with _f.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = {ex.submit(download_and_score_file, k, f"{start}~{end}"): k for k in keys}
        for f in _f.as_completed(futs):
            r = f.result()
            if not r:
                continue
                
            # 모든 데이터 타입을 허용
            schema = r.get("schema")
            file_path = r.get("id", "").lower()
            
            if schema not in ["raw_list", "houravg", "minavg", "mintrend", None]:
                continue
                
            # rawdata, houravg, minavg, mintrend 파일들은 모두 처리 대상
            if not any(pattern in file_path for pattern in ["rawdata", "houravg", "minavg", "mintrend"]) and schema is None:
                continue
            rows = _load_raw_rows(r.get("json") or [])
            if not rows:
                continue
            subset = select_rows_in_range(rows, start, end)
            if subset:
                all_rows.extend(subset)
                if raw_tag is None:
                    raw_tag = "D?"
    all_rows.sort(key=lambda x: x["timestamp"])
    return all_rows, raw_tag

def fetch_raw_exact_second_all(target_dt: datetime, max_files: int = MAX_FILES_TO_SCAN) -> Tuple[Optional[dict], Optional[str]]:
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX)
    with _f.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = []
        scanned = 0
        for page in pages:
            for obj in page.get("Contents", []):
                k = obj["Key"]
                if not k.lower().endswith(".json"):
                    continue
                futures.append(ex.submit(download_and_score_file, k, str(target_dt)))
                scanned += 1
                if scanned >= max_files:
                    break
            if scanned >= max_files:
                break
        for f in _f.as_completed(futures):
            r = f.result()
            if not r or r.get("schema") != "raw_list":
                continue
            rows = _load_raw_rows(r.get("json") or [])
            for row in rows:
                if row["timestamp"] == target_dt:
                    return row, "D?"
    return None, None

def show_hourly_average_if_requested(query: str) -> Optional[str]:
    """시간별 평균이 요청되면 해당 시간의 houravg 데이터로 처리"""
    if not hourly_average_requested(query):
        return None
    
    # 날짜와 시간 추출
    dt_strings = extract_datetime_strings(query)
    target_dts = []
    
    # 모든 시간을 추출 (복수 시간 처리)
    for ds in dt_strings:
        dt = parse_dt(ds)
        if dt:
            target_dts.append(dt)
    
    if not target_dts:
        # 현재 시간의 이전 시간 사용 (정시로 맞춤)
        from datetime import datetime as datetime_cls
        now = datetime_cls.now()
        target_dt = now.replace(minute=0, second=0, microsecond=0)
        if now.minute < 30:  # 30분 이전이면 이전 시간 사용
            target_dt = target_dt - timedelta(hours=1)
        target_dts = [target_dt]
    
    # 요청된 필드 추출
    need_fields = detect_fields_in_query(query)
    results = []
    
    # 각 시간에 대해 데이터 찾기
    for target_dt in target_dts:
        doc = find_houravg_doc_for_hour(target_dt)
        
        if doc:
            # 개별 시간 결과 포맷팅
            time_str = target_dt.strftime('%Y년 %m월 %d일 %H시')
            result = format_houravg_answer_from_doc(doc, need_fields)
            results.append(f"**{time_str}:**\n{result}")
        else:
            time_str = target_dt.strftime('%Y년 %m월 %d일 %H시')
            results.append(f"**{time_str}:**\n해당 시간의 데이터를 찾을 수 없습니다.")
    
    if not results:
        return "요청하신 시간대의 데이터를 찾을 수 없습니다."
    
    # 복수 결과를 합쳐서 반환
    return "\n\n".join(results)

def show_daily_summary_if_requested(query: str) -> Optional[str]:
    """일간 요약이 요청되면 해당 날짜의 hourly 데이터로 일 평균과 추이 계산"""
    if not daily_summary_requested(query):
        return None
    
    # 날짜 추출
    dt_strings = extract_datetime_strings(query)
    target_date = None
    
    for ds in dt_strings:
        dt = parse_dt(ds)
        if dt:
            target_date = dt.replace(hour=0, minute=0, second=0, microsecond=0)
            break
    
    if not target_date:
        # 날짜가 없으면 오늘 날짜 사용
        target_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 해당 날짜의 hourly 데이터 수집
    docs = find_houravg_docs_for_day(target_date)
    
    if not docs:
        return f"{target_date.strftime('%Y년 %m월 %d일')}의 시간별 데이터를 찾을 수 없습니다."
    
    # 요청된 필드 추출
    need_fields = detect_fields_in_query(query)
    
    # 일간 요약 포맷팅
    return format_daily_summary_from_houravg(docs, need_fields)

def show_last_detail_if_any(query: str, session=None) -> Optional[str]:
    if not want_detail_list(query):
        return None
    
    # 세션에서 컨텍스트 가져오기
    ctx = _get_last_ctx(session)
    
    if not ctx.get("start") or not ctx.get("end"):
        return None
    if not ctx.get("rows"):
        rows, raw_tag = fetch_raw_rows_for_window_all(ctx["start"], ctx["end"])
        if rows:
            _set_last_ctx(
                window=ctx.get("window") or "range",
                start=ctx["start"],
                end=ctx["end"],
                rows=rows,
                tag=raw_tag or ctx.get("tag") or "D?",
                label=ctx.get("label") or "요청 구간",
                session=session
            )
        else:
            return "(최근 센서 구간의 원본 샘플을 찾지 못했어요. 시간/구간이 포함된 센서 질문을 먼저 해주세요.)"

    return _format_full_rows(
        rows=ctx["rows"],
        start=ctx["start"],
        end=ctx["end"],
        tag=ctx["tag"] or "D?",
        label=ctx["label"] or "요청 구간"
    )


# ===== 보조: 파일 탐색 (정확 매칭) =====
def find_houravg_docs_for_day(target_date: datetime, max_scan: int = MAX_FILES_TO_SCAN):
    """하루 전체의 houravg 문서들을 수집"""
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX)
    
    docs = []
    scanned = 0
    for page in pages:
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if not k.lower().endswith(".json"):
                continue
            key_dt, gran = parse_time_from_key(k)
            if gran == "hour" and key_dt and \
               (key_dt.year, key_dt.month, key_dt.day) == \
               (target_date.year, target_date.month, target_date.day):
                d = download_and_score_file(k, f"{target_date}")
                if d and d.get("schema") == "houravg":
                    d["tag"] = d.get("tag","D?")
                    d["hour"] = key_dt.hour
                    docs.append(d)
            scanned += 1
            if scanned >= max_scan:
                break
        if scanned >= max_scan:
            break
    return sorted(docs, key=lambda x: x.get("hour", 0))

def calculate_daily_average_from_houravg(docs):
    """houravg 문서들로부터 일 평균 계산"""
    if not docs:
        return {}
    
    temp_values = []
    hum_values = []
    gas_values = []
    
    for doc in docs:
        j = doc.get("json") or {}
        av = j.get("averages", {}) or {}
        
        if av.get("temp") is not None:
            temp_values.append(av["temp"])
        if av.get("hum") is not None:
            hum_values.append(av["hum"])
        if av.get("gas") is not None:
            gas_values.append(av["gas"])
    
    daily_avg = {}
    if temp_values:
        daily_avg["temperature"] = sum(temp_values) / len(temp_values)
    if hum_values:
        daily_avg["humidity"] = sum(hum_values) / len(hum_values)
    if gas_values:
        daily_avg["gas"] = sum(gas_values) / len(gas_values)
    
    return daily_avg

def calculate_daily_trend_from_houravg(docs):
    """houravg 문서들로부터 전체적 추이 계산"""
    if not docs:
        return {}
    
    trends = {}
    
    for field in ["temp", "hum", "gas"]:
        field_name = {"temp": "temperature", "hum": "humidity", "gas": "gas"}[field]
        values = []
        
        for doc in sorted(docs, key=lambda x: x.get("hour", 0)):
            j = doc.get("json") or {}
            av = j.get("averages", {}) or {}
            if av.get(field) is not None:
                values.append((doc.get("hour", 0), av[field]))
        
        if len(values) >= 2:
            start_value = values[0][1]
            end_value = values[-1][1]
            change = end_value - start_value
            change_rate = (change / start_value) * 100 if start_value != 0 else 0
            
            if change_rate > 5:
                status = "상승"
            elif change_rate < -5:
                status = "하락"
            else:
                status = "안정"
                
            trends[field_name] = {
                "start_value": start_value,
                "end_value": end_value,
                "change_rate": f"{change_rate:.1f}%",
                "status": status
            }
    
    return trends

def find_houravg_doc_for_hour(target_dt: datetime, max_scan: int = MAX_FILES_TO_SCAN):
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX)

    scanned = 0
    for page in pages:
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if not k.lower().endswith(".json"):
                continue
            key_dt, gran = parse_time_from_key(k)
            if gran == "hour" and key_dt and \
               (key_dt.year, key_dt.month, key_dt.day, key_dt.hour) == \
               (target_dt.year, target_dt.month, target_dt.day, target_dt.hour):
                d = download_and_score_file(k, f"{target_dt}")
                if d and d.get("schema") == "houravg":
                    d["tag"] = d.get("tag","D?")
                    return d
            scanned += 1
            if scanned >= max_scan:
                break
        if scanned >= max_scan:
            break
    return None

def find_minavg_doc_for_minute(target_dt: datetime, max_scan: int = MAX_FILES_TO_SCAN):
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=S3_BUCKET_DATA, Prefix=S3_PREFIX)
    scanned = 0
    for page in pages:
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if not k.lower().endswith(".json"):
                continue
            key_dt, gran = parse_time_from_key(k)
            if gran == "minute" and key_dt and \
               (key_dt.year, key_dt.month, key_dt.day, key_dt.hour, key_dt.minute) == \
               (target_dt.year, target_dt.month, target_dt.day, target_dt.hour, target_dt.minute):
                d = download_and_score_file(k, f"{target_dt}")
                if d and d.get("schema") == "minavg":
                    d["tag"] = d.get("tag","D?")
                    return d
            scanned += 1
            if scanned >= max_scan:
                break
        if scanned >= max_scan:
            break
    return None

# ===== 형식화 유틸 (houravg 출력) =====
def format_daily_summary_from_houravg(docs, need_fields: set) -> str:
    """일 평균과 전체적 추이를 포맷팅"""
    if not docs:
        return "해당 날짜의 시간별 데이터가 없습니다."
    
    daily_avg = calculate_daily_average_from_houravg(docs)
    daily_trend = calculate_daily_trend_from_houravg(docs)
    
    fields = list(need_fields) if need_fields else ["temperature", "humidity", "gas"]
    lines = ["[일간 요약 (houravg 기반)]"]
    
    for f in fields:
        name = FIELD_NAME_KOR.get(f, f)
        
        # 일 평균
        if f in daily_avg:
            lines.append(f"{name} 일 평균: {daily_avg[f]:.1f}")
        
        # 전체적 추이
        if f in daily_trend:
            t = daily_trend[f]
            cr = t.get("change_rate")
            st = t.get("status")
            se = f"(시작 {t.get('start_value'):.1f}, 끝 {t.get('end_value'):.1f})"
            lines.append(f"{name} 전체 추이: {st} {cr} {se}")
    
    lines.append(f"[총 {len(docs)}시간 데이터]")
    return "\n".join(lines)

def format_houravg_answer_from_doc(d, need_fields: set) -> str:
    tag = d.get("tag","D?")
    j = d.get("json") or {}
    av = j.get("averages", {}) or {}
    ranges = j.get("hourly_ranges", {}) or {}
    trends = j.get("trends", {}) or {}

    av_std = {"temperature": av.get("temp") or j.get("hourtemp"),
              "humidity": av.get("hum") or j.get("hourhum"), 
              "gas": av.get("gas") or j.get("hourgas")}
    rng_std = {
        "temperature": (ranges.get("temp") or {}),
        "humidity":    (ranges.get("hum") or {}),
        "gas":         (ranges.get("gas") or {}),
    }
    tr_std  = {
        "temperature": trends.get("temperature"),
        "humidity":    trends.get("humidity"),
        "gas":         trends.get("gas"),
    }

    fields = list(need_fields) if need_fields else ["temperature","humidity","gas"]

    if len(fields) == 1:
        f = fields[0]
        name = FIELD_NAME_KOR.get(f, f)
        parts = []
        if av_std.get(f) is not None:
            parts.append(f"{name} 평균: {av_std[f]}")
        r = rng_std.get(f) or {}
        if r:
            parts.append(f"{name} 범위: [{r.get('min')}~{r.get('max')}]")
        t = tr_std.get(f)
        if t:
            cr = t.get("change_rate"); st = t.get("status")
            se = f"(시작 {t.get('start_value')}, 끝 {t.get('end_value')})" if t and t.get("start_value") is not None else ""
            parts.append(f"{name} 추세: {st} {cr} {se}".strip())
        return ("\n".join(parts) if parts else f"{name}: 데이터 없음") + f" [{tag}]"

    lines = ["[시간 단위 집계 요약]"]
    for f in fields:
        name = FIELD_NAME_KOR.get(f, f)
        if av_std.get(f) is not None:
            lines.append(f"{name} 평균: {av_std[f]}")
        r = rng_std.get(f) or {}
        if r:
            lines.append(f"{name} 범위: [{r.get('min')}~{r.get('max')}]")
        t = tr_std.get(f)
        if t:
            cr = t.get("change_rate"); st = t.get("status")
            se = f"(시작 {t.get('start_value')}, 끝 {t.get('end_value')})" if t and t.get("start_value") is not None else ""
            lines.append(f"{name} 추세: {st} {cr} {se}".strip())
    overall = trends.get("overall")
    if overall:
        lines.append(f"전체 추세: {overall}")
    return "\n".join(lines) + f" [{tag}]"

def format_minavg_answer_from_doc(d, need_fields: set) -> str:
    tag = d.get("tag","D?")
    j = d.get("json") or {}
    
    # 실제 minavg 데이터 구조에 맞게 파싱
    av_std = {"temperature": j.get("mintemp"),
              "humidity": j.get("minhum"), 
              "gas": j.get("mingas")}

    fields = list(need_fields) if need_fields else ["temperature","humidity","gas"]

    if len(fields) == 1:
        f = fields[0]
        name = FIELD_NAME_KOR.get(f, f)
        value = av_std.get(f)
        if value is not None:
            return f"해당 분의 {name}는 평균 **{value}**입니다. [{tag}]"
        else:
            return f"해당 분의 {name} 데이터가 없습니다. [{tag}]"

    lines = ["**분 단위 환경 상태**"]
    for f in fields:
        name = FIELD_NAME_KOR.get(f, f)
        value = av_std.get(f)
        if value is not None:
            lines.append(f"• {name}: **{value}**")
        else:
            lines.append(f"• {name}: 데이터 없음")
    return "\n".join(lines) + f" [{tag}]"


# ===== 정확 모드 =====
def find_sensor_data_from_s3_logs(query: str) -> Optional[Dict]:
    """
    S3 로그 데이터에서 해당 시간의 센서 데이터를 찾는 함수
    """
    # 요청된 시간 추출
    target_dt = None
    dt_strings = extract_datetime_strings(query)
    for ds in dt_strings:
        dt = parse_dt(ds)
        if dt:
            target_dt = dt
            break
    
    if not target_dt:
        return None
    
    try:
        # S3에서 로그 파일 목록 조회 (최근 1000개)
        prefix = f"{CHATLOG_PREFIX}{SESSION_ID}/"
        response = s3_logs.list_objects_v2(Bucket=CHATLOG_BUCKET, Prefix=prefix, MaxKeys=1000)
        
        if 'Contents' not in response:
            return None
        
        # 각 로그 파일을 확인해서 해당 시간의 센서 데이터 찾기
        for obj in response['Contents']:
            try:
                log_response = s3_logs.get_object(Bucket=CHATLOG_BUCKET, Key=obj['Key'])
                log_data = json.loads(log_response['Body'].read().decode('utf-8'))
                
                # sensor_data 필드가 있는지 확인
                sensor_data_list = log_data.get('sensor_data', [])
                if not sensor_data_list:
                    continue
                
                # 해당 시간과 일치하는 센서 데이터 찾기
                for sensor_entry in sensor_data_list:
                    data = sensor_entry.get('data')
                    if not data:
                        continue
                    
                    schema = sensor_entry.get('schema')
                    if schema == 'raw_list' and isinstance(data, list):
                        # raw_list에서 정확한 시간 찾기
                        for row in data:
                            row_time = datetime.strptime(row['timestamp'], '%Y-%m-%d %H:%M:%S')
                            if row_time == target_dt:
                                return {
                                    'timestamp': row['timestamp'],
                                    'temperature': row.get('temperature'),
                                    'humidity': row.get('humidity'),
                                    'gas': row.get('gas'),
                                    'source': 's3_log',
                                    'log_key': obj['Key']
                                }
                    
                    elif schema in ['minavg', 'houravg'] and isinstance(data, dict):
                        # 집계 데이터에서 시간 단위별 매칭
                        data_time = datetime.strptime(data['timestamp'], '%Y-%m-%d %H:%M:%S')
                        
                        # 분 단위 비교 (minavg) 또는 시간 단위 비교 (houravg)
                        if schema == 'minavg' and data_time.replace(second=0) == target_dt.replace(second=0):
                            return {
                                'timestamp': data['timestamp'],
                                'temperature': data.get('temperature'),
                                'humidity': data.get('humidity'),
                                'gas': data.get('gas'),
                                'source': 's3_log',
                                'schema': schema,
                                'log_key': obj['Key']
                            }
                        elif schema == 'houravg' and data_time.replace(minute=0, second=0) == target_dt.replace(minute=0, second=0):
                            return {
                                'timestamp': data['timestamp'],
                                'temperature': data.get('temperature'),
                                'humidity': data.get('humidity'),
                                'gas': data.get('gas'),
                                'source': 's3_log',
                                'schema': schema,
                                'log_key': obj['Key']
                            }
            
            except Exception:
                continue  # 해당 로그 파일 처리 실패시 다음으로
        
        return None
        
    except Exception as e:
        pass
        return None

# ===== 채팅 히스토리/후속 질문 처리 & 저장 =====
CHATLOG_PREFIX = "chatlogs/"
ENABLE_CHATLOG_SAVE = True
MAX_HISTORY_TURNS = 50  # 전체 세션 기억하도록 증가

# 세션 관리 클래스
class UserSession:
    def __init__(self, session_id: str = None):
        if session_id:
            self.session_id = session_id
            # 기존 세션이면 히스토리 로드 시도
            self.history, self.turn_id, self.last_sensor_ctx, self.followup_timestamp, self.followup_context = load_session_history(session_id)
        else:
            self.session_id = datetime.now(KST).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
            self.turn_id = 0
            self.history: List[Dict] = []
            self.last_sensor_ctx: Dict[str, object] = {}
            self.followup_timestamp = None
            self.followup_context = {}
            
        # last_sensor_ctx 기본값 설정
        if not self.last_sensor_ctx:
            self.last_sensor_ctx = {
                "window": None,
                "start": None, 
                "end": None,
                "rows": None,
                "tag": None,
                "label": None
            }
        
        # followup_context 초기화
        if not hasattr(self, 'followup_context'):
            self.followup_context = {}
            
        self.created_at = datetime.now(KST)
        self.last_activity = datetime.now(KST)
    
    def update_activity(self):
        self.last_activity = datetime.now(KST)
    
    def increment_turn(self):
        self.turn_id += 1
        return self.turn_id
    
    def add_to_history(self, query: str, answer: str, route: str):
        self.history.append({"query": query, "answer": answer, "route": route})
        # 히스토리 길이 제한
        if len(self.history) > MAX_HISTORY_TURNS:
            self.history = self.history[-MAX_HISTORY_TURNS:]
        # 자동 저장
        self.save_to_file()
    
    def save_to_file(self):
        """현재 세션을 파일에 저장"""
        save_session_history(
            self.session_id, 
            self.history, 
            self.turn_id, 
            self.last_sensor_ctx, 
            self.followup_timestamp,
            getattr(self, 'followup_context', {})
        )
    
    def clear_last_sensor_ctx(self):
        self.last_sensor_ctx.update({
            "window": None, 
            "start": None, 
            "end": None, 
            "rows": None, 
            "tag": None, 
            "label": None
        })
    
    def update_last_sensor_ctx(self, window, start, end, rows, tag, label):
        self.last_sensor_ctx["window"] = window
        self.last_sensor_ctx["start"] = start
        self.last_sensor_ctx["end"] = end
        self.last_sensor_ctx["rows"] = rows
        self.last_sensor_ctx["tag"] = tag
        self.last_sensor_ctx["label"] = label

# 전역 세션 저장소
USER_SESSIONS: Dict[str, UserSession] = {}
SESSION_TIMEOUT = (60*60) * 60  # 1시간 후 세션 만료

def get_or_create_session(session_id: str = None):
    """세션을 가져오거나 새로 생성"""
    if session_id and session_id in USER_SESSIONS:
        session = USER_SESSIONS[session_id]
        session.update_activity()
        return session
    
    # 새 세션 생성 (사용자 제공 ID 사용 또는 자동 생성)
    new_session = UserSession(session_id)
    USER_SESSIONS[new_session.session_id] = new_session
    
    # 만료된 세션 정리
    cleanup_expired_sessions()
    
    return new_session

def cleanup_expired_sessions():
    """만료된 세션들을 정리"""
    now = datetime.now(KST)
    expired_sessions = []
    
    for session_id, session in USER_SESSIONS.items():
        if (now - session.last_activity).total_seconds() > SESSION_TIMEOUT:
            expired_sessions.append(session_id)
    
    for session_id in expired_sessions:
        del USER_SESSIONS[session_id]
    
    if expired_sessions:
        print(f"정리된 만료 세션: {len(expired_sessions)}개")

# 하위 호환성을 위한 전역 변수들 (기본 세션용) 
SESSION_ID = datetime.now(KST).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
TURN_ID = 0
HISTORY: List[Dict] = []

_FOLLOWUP_HINTS = ("같은", "그때", "그 때", "방금", "이전", "앞의", "동일", "위의", "아까", "해당", "최근", "습도", "공기질", "이산화탄소", "CO2", "gas")

def reset_session():
    """세션 종료 시 히스토리와 컨텍스트 초기화"""
    global HISTORY, TURN_ID, SESSION_ID
    HISTORY.clear()
    TURN_ID = 0
    SESSION_ID = datetime.now(KST).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    clear_followup_timestamp()
    _reset_last_ctx()
    print("[세션] 대화 히스토리가 초기화되었습니다.")

# 후속질문용 기준 타임스탬프 저장
_FOLLOWUP_TIMESTAMP = None

def set_followup_timestamp(dt: datetime, session=None):
    """후속질문용 기준 타임스탬프 설정"""
    if session:
        session.followup_timestamp = dt
    else:
        global _FOLLOWUP_TIMESTAMP
        _FOLLOWUP_TIMESTAMP = dt

def set_followup_context(context_type: str, context_data: dict, session=None):
    """후속질문용 컨텍스트 설정 (범위, 일간평균 등)"""
    if session:
        session.followup_context = {
            "type": context_type,
            "data": context_data
        }
    else:
        global _FOLLOWUP_CONTEXT
        _FOLLOWUP_CONTEXT = {
            "type": context_type,
            "data": context_data
        }

def get_followup_context(session=None) -> dict:
    """후속질문용 컨텍스트 반환"""
    if session:
        return getattr(session, 'followup_context', {})
    else:
        return globals().get('_FOLLOWUP_CONTEXT', {})

def get_followup_timestamp(session=None) -> Optional[datetime]:
    """후속질문용 기준 타임스탬프 반환"""
    if session:
        return session.followup_timestamp
    else:
        return _FOLLOWUP_TIMESTAMP

def clear_followup_timestamp(session=None):
    """후속질문용 기준 타임스탬프 초기화"""
    if session:
        session.followup_timestamp = None
    else:
        global _FOLLOWUP_TIMESTAMP
        _FOLLOWUP_TIMESTAMP = None

def expand_followup_query_with_last_window(query: str, session=None) -> str:
    """후속 질문에 이전 질문의 정확한 시간 정보 추가"""
    # 현재 질문에 이미 시간 정보가 있으면 후속질문이 아님
    current_dt_strings = extract_datetime_strings(query)
    if current_dt_strings:
        return query
    
    # 상대적 시간 표현이 있으면 후속질문이 아님 (직접 처리)
    offset_value, offset_unit = extract_time_offset(query)
    if offset_value and offset_unit:
        return query
    
    # 최근/현재 데이터 요청은 후속질문이 아님 (독립적인 새 질문)
    if is_recent_query(query):
        return query
    
    # 센서 관련 질문이면서 시간 정보가 없는 경우도 후속질문으로 처리
    sensor_keywords = ("온도", "습도", "공기질", "이산화탄소", "CO2", "gas", "temperature", "humidity")
    is_sensor_query = any(keyword in query for keyword in sensor_keywords)
    
    # 후속질문 힌트가 있거나, 센서 관련 질문이면서 시간 정보가 없는 경우
    has_followup_hint = any(h in query for h in _FOLLOWUP_HINTS)
    
    # 센서 관련 질문이 아닌 경우에는 시간 추가 안함 (일반 대화는 히스토리로 처리)
    if not is_sensor_query:
        return query
    
    if not (has_followup_hint or is_sensor_query):
        return query
    
    # 새로운 컨텍스트 기반 후속 질문 처리
    followup_context = get_followup_context(session)
    print(f"[DEBUG] followup_context: {followup_context}")
    if followup_context:
        context_type = followup_context.get("type")
        context_data = followup_context.get("data", {})
        print(f"[DEBUG] context_type: {context_type}, context_data: {context_data}")
        
        if context_type == "time_range":
            # 범위 질문 후속 처리 (13시~15시)
            start_time = context_data.get("start_time")
            end_time = context_data.get("end_time")
            if start_time and end_time:
                expanded_query = f"{start_time.strftime('%Y년 %m월 %d일 %H시')}부터 {end_time.strftime('%H시')}까지 {query}"
                print(f"[DEBUG] 범위 후속 확장: {expanded_query}")
                return expanded_query
                
        elif context_type == "daily_average":
            # 일간 평균 후속 처리 (8월 14일 전체)
            date_str = context_data.get("date")
            if date_str:
                expanded_query = f"{date_str} {query}"
                print(f"[DEBUG] 일간평균 후속 확장: {expanded_query}")
                return expanded_query
    
    # 기존 단일 타임스탬프 방식 fallback
    followup_timestamp = get_followup_timestamp(session)
    if followup_timestamp:
        expanded = f"{followup_timestamp.strftime('%Y년 %m월 %d일 %H시 %M분')} {query}"
        return expanded
    
    # 이전 방식 fallback (세션별)
    ctx = _get_last_ctx(session)
    s, e = ctx.get("start"), ctx.get("end")
    if not (s and e):
        return query
    return f"{query} (기준 구간: {s.strftime('%Y-%m-%d %H:%M:%S')}~{e.strftime('%Y-%m-%d %H:%M:%S')})"

def _build_history_block(history: List[Dict]) -> str:
    if not history:
        return ""
    lines = []
    for h in history[-MAX_HISTORY_TURNS:]:
        a = h.get("answer", "")
        if len(a) > 1000:  # 히스토리 길이 제한 확장
            a = a[:1000] + " …(이하 생략)"
        lines.append(f"Q: {h.get('query','')}\nA: {a}")
    return "\n\n[이전 대화(참고용)]\n" + "\n\n".join(lines) + "\n"

def save_turn_to_s3(
    session_id: str,
    turn_id: int,
    route: str,
    query: str,
    answer: str,
    top_docs: List[Dict],
) -> Optional[str]:
    try:
        meta_docs = []
        for d in (top_docs or [])[:TOP_K]:
            meta_docs.append({
                "key": d.get("id"),
                "score": d.get("score"),
                "schema": d.get("schema"),
                "tag": d.get("tag"),
                "file_size": d.get("file_size"),
            })

        rec = {
            "session_id": session_id,
            "turn_id": turn_id,
            "ts_kst": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
            "route": route,      # "sensor" | "general"
            "query": query,
            "answer": answer,
            "docs": meta_docs,
            "last_sensor_ctx": {
                "window": LAST_SENSOR_CTX.get("window"),
                "start": LAST_SENSOR_CTX.get("start").strftime("%Y-%m-%d %H:%M:%S") if LAST_SENSOR_CTX.get("start") else None,
                "end":   LAST_SENSOR_CTX.get("end").strftime("%Y-%m-%d %H:%M:%S") if LAST_SENSOR_CTX.get("end") else None,
                "tag":   LAST_SENSOR_CTX.get("tag"),
                "label": LAST_SENSOR_CTX.get("label"),
            },
        }
        key = f"{CHATLOG_PREFIX}{session_id}/{turn_id:04d}_{int(time.time())}.json"
        # 서로게이트 문자 처리
        def clean_surrogate_chars(text):
            if isinstance(text, str):
                # 서로게이트 문자 제거
                return text.encode('utf-8', errors='ignore').decode('utf-8')
            elif isinstance(text, dict):
                return {k: clean_surrogate_chars(v) for k, v in text.items()}
            elif isinstance(text, list):
                return [clean_surrogate_chars(item) for item in text]
            else:
                return text
        
        cleaned_rec = clean_surrogate_chars(rec)
        
        s3_logs.put_object(
            Bucket=CHATLOG_BUCKET,
            Key=key,
            Body=json.dumps(cleaned_rec, ensure_ascii=False).encode("utf-8"),
            ContentType="application/json",
        )
        return key
    except Exception:
        traceback.print_exc()
        pass
        return None

# ===== 프롬프트 =====
def build_prompt(query: str, context: str, history: List[Dict] = None) -> str:
    hist_block = _build_history_block(history or [])
    current_time = datetime.now().strftime('%Y년 %m월 %d일 %H시 %M분')
    
    return (
        "당신은 친근하고 전문적인 스마트홈 어시스턴트야. 실시간 센서 데이터를 바탕으로 사용자에게 도움이 되는 정보를 제공해.\n\n"
        
        f"**현재 시간:** {current_time}\n"
        "사용자가 현재 시간을 물어보거나 '지금', '현재'라는 표현을 사용하면 반드시 위의 현재 시간을 사용해.\n"
        "절대로 이전 대화나 센서 데이터의 시간과 혼동하지 마.\n\n"
        
        "**중요**: 아래 센서 데이터 섹션에 특정 날짜와 시간의 데이터가 제공되어 있다면, 그 데이터를 사용해서 답변해.\n"
        "현재 시간과 센서 데이터의 시간을 절대 혼동하지 마.\n\n"
        
        "답변 가이드라인:\n"
        "1. 반드시 위의 센서 데이터 섹션만을 참조해서 답변해. 다른 날짜나 시간의 데이터는 언급하지 마\n"
        "2. 센서 데이터에 정확한 날짜와 시간이 표시되어 있으면 해당 데이터를 사용해\n"
        "3. 물어보는 질의를 명확히 제시하고 현재 상황을 친근하게 설명해\n"
        "4. 측정 시점을 정확히 언급해 (예: '8월 11일 14시 1분') - 24시간제로 표시\n"
        "5. 상황에 따른 실용적인 조언을 해 (에어컨, 환기, 제습기 등)\n"
        "6. 건강이나 편안함과 관련된 팁을 제공해\n"
        "7. 온도 기준: 18도 미만(춥다), 18-22도(시원), 22-26도(적정), 26-30도(따뜻), 30도이상(더워), 대신 온도를 물어보면 대답해\n"
        "8. 습도 기준: 30%미만(건조), 30-40%(쾌적), 40-60%(적정), 60-70%(습함), 70%이상(매우습함), 대신 습도를 물어보면 대답해\n"
        "9. CO2 기준: 400ppm미만(매우깨끗), 400-600ppm(좋음), 600-1000ppm(보통), 1000-1500ppm(환기필요), 1500ppm이상(환기권장), 대신 공기질을 물어보면 대답해\n"
        "10. 반드시 데이터 출처 태그([D1], [D2] 등)를 포함해\n"
        "11. 이모티콘은 사용하지 마\n" 
        "12. **은 사용하지 마\n"
        "13. 사용자가 질문한 센서 정보만 답변해 (온도만 물어보면 온도만, 습도만 물어보면 습도만, 공기질만 물어보면 이산화탄소만)\n"
        "14. 공기질은 이산화탄소로 대답해\n"
        "15. gas는 이산화탄소, CO2와 같으니 gas, CO2는 모두 이산화탄소로 대답해\n"
        "16. 몇 시간 전에 데이터를 물어볼 때, 같은 시간, 같은 분이면 같은 데이터야. (예시: 5시 1분의 3시간 전은 2시 1분인데, 2시 1분 데이터가 있으니 같은거)\n"
        "17. 이전, 방금, 금방의 내용이나 대화 기록을 물을 때는 위의 [이전 대화] 섹션을 참조해서 정확하게 대답해\n"
        "18. [이전 대화]를 참조하는데, 물어본 질문에만 대답해\n"
        "19. '현재 시간'이나 '지금'을 말할 때는 반드시 위의 **현재 시간**을 사용해. 이전 대화의 시간과 혼동하지 마\n"
        "20. 센서 데이터 시간과 현재 시간을 명확히 구분해서 답변해\n"
        "21. 몇 월인지 말하지 않을 때, 몇 월인지 물어보고, 현재 있는 데이터에 기반해서 말해\n"
        "22. 컨텍스트에 없는 내용은 추측하지 마\n\n"
        
        f"{hist_block}"
        f"**센서 데이터:**\n{context if context else '데이터를 찾을 수 없습니다.'}\n\n"
        f"**사용자 질문:** {query}\n\n"
        "위 센서 데이터를 참고해서 친근하고 도움이 되는 답변을 해"
    )

def build_general_prompt(query: str, history: List[Dict] = None) -> str:
    hist_block = _build_history_block(history or [])
    current_time = datetime.now().strftime('%Y년 %m월 %d일 %H시 %M분')
    
    return (
        "너는 유능한 AI 어시스턴트야. 사용자의 질문에 대해 친절하고 정확하게 답변해줘.\n"
        "필요한 만큼 충분히 설명하되, 명확하고 이해하기 쉽게 답변해줘.\n\n"
        "답변 가이드라인:\n"
        "1. 이전 대화나 질문 기록을 물어보면 위의 [이전 대화] 섹션을 정확히 참조해서 답변해\n"
        "2. '내가 물어본 질문', '방금 뭐라고 했어' 등은 이전 대화에서 정확히 찾아서 답변해\n"
        "3. 데이터에 없는 내용은 추측하지 말고 '모른다'고 답변해\n"
        "4. **은 사용하지 마\n\n"
        
        f"**현재 시간:** {current_time}\n"
        "사용자가 현재 시간을 물어보면 위 현재 시간으로 답변해줘.\n\n"
        
        f"{hist_block}"
        f"[질문]\n{query}"
    )

# ===== Claude 기반 답변 생성 =====
@lru_cache(maxsize=0)
def generate_answer_with_nova(prompt: str) -> str:
    system_msg = None
    messages = [
        {"role": "user", "content": [{"type": "text", "text": prompt}]}
    ]
    text, payload = _invoke_claude(
        messages,
        max_tokens=1024,
        temperature=0.2,
        top_p=0.9,
        system=system_msg
    )
    if text:
        return text
    return json.dumps(payload, ensure_ascii=False)[:2000]

# ===== Chat Loop =====
def show_session_menu() -> str:
    """세션 선택 메뉴 표시"""
    print("\n=== 세션 선택 ===")
    print("1. 새 세션 시작")
    print("2. 기존 세션 계속하기")
    print("3. 저장된 세션 목록 보기")
    
    while True:
        choice = input("선택하세요 (1-3): ").strip()
        if choice == "1":
            return None  # 새 세션
        elif choice == "2":
            session_id = input("세션 ID를 입력하세요: ").strip()
            if session_id:
                return session_id
            print("올바른 세션 ID를 입력해주세요.")
        elif choice == "3":
            sessions = list_session_files()
            if not sessions:
                print("저장된 세션이 없습니다.")
                continue
            print("\n=== 저장된 세션 목록 ===")
            for i, session_id in enumerate(sessions, 1):
                # 세션 정보 간단히 표시
                try:
                    history, turn_id, _, _ = load_session_history(session_id)
                    print(f"{i}. {session_id} (대화 {len(history)}개, 턴 {turn_id})")
                except:
                    print(f"{i}. {session_id} (정보 없음)")
            
            choice_num = input(f"세션을 선택하세요 (1-{len(sessions)}) 또는 엔터로 돌아가기: ").strip()
            if choice_num.isdigit():
                idx = int(choice_num) - 1
                if 0 <= idx < len(sessions):
                    return sessions[idx]
            print("메뉴로 돌아갑니다.")
        else:
            print("1, 2, 3 중에서 선택해주세요.")

def chat_with_session(session_id: str = None):
    """세션 기반 채팅 함수"""
    if session_id is None:
        session_id = show_session_menu()
    
    session = get_or_create_session(session_id)
    
    print("\nRAG Chatbot (S3 + Bedrock Claude Sonnet 4) - 다중 사용자 지원")
    print(f"[세션] SESSION_ID = {session.session_id}")
    print(f"[세션] 활성 세션 수: {len(USER_SESSIONS)}")
    if len(session.history) > 0:
        print(f"[세션] 이전 대화 {len(session.history)}개 로드됨")
    print("- 정확 매칭 모드: 시/분/초는 정확히 일치할 때만 응답")
    print("- RAW·MINAVG·HOURAVG 자동 인식 / 초·분·시간·일 / 구간·지속시간 / 추이 / 처음·마지막 / 원본")
    print("- '상세/자세히/상세히/원본/목록'으로 직전 창 RAW 전체 출력 + 새 센서 질문 시 컨텍스트 초기화")
    print(f"설정: 병렬 워커 {MAX_WORKERS}개, 최대 파일 크기 {MAX_FILE_SIZE//1024}KB, 관련도 임계치 {RELEVANCE_THRESHOLD}")
    print(f"히스토리: 최대 {MAX_HISTORY_TURNS}턴 기억, 세션별 독립 관리, 자동 저장")
    print("질문을 입력하세요. 종료하려면 'exit'/'quit'/'q' 입력.\n")

    return chat_loop(session)

def chat():
    """기존 호환성을 위한 단일 세션 채팅 함수"""
    print("RAG Chatbot (S3 + Bedrock Claude Sonnet 4)")
    print(f"[세션] SESSION_ID = {SESSION_ID}")
    print("- 정확 매칭 모드: 시/분/초는 정확히 일치할 때만 응답")
    print("- RAW·MINAVG·HOURAVG 자동 인식 / 초·분·시간·일 / 구간·지속시간 / 추이 / 처음·마지막 / 원본")
    print("- '상세/자세히/상세히/원본/목록'으로 직전 창 RAW 전체 출력 + 새 센서 질문 시 컨텍스트 초기화")
    print(f"설정: 병렬 워커 {MAX_WORKERS}개, 최대 파일 크기 {MAX_FILE_SIZE//1024}KB, 관련도 임계치 {RELEVANCE_THRESHOLD}")
    print(f"히스토리: 최대 {MAX_HISTORY_TURNS}턴 기억, 종료시 자동 초기화")
    print("질문을 입력하세요. 종료하려면 'exit'/'quit'/'q' 입력.\n")

    global TURN_ID, HISTORY
    return chat_loop(session=None)

def chat_loop(session=None):
    """세션 기반 채팅 루프"""
    # 세션이 없으면 전역 변수 사용 (하위 호환성)
    use_global = (session is None)
    
    if use_global:
        global TURN_ID, HISTORY

    while True:
        try:
            query_raw = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            if session:
                session.clear_last_sensor_ctx()
                clear_followup_timestamp(session)
            else:
                reset_session()
            break

        if query_raw.lower() in {"exit", "quit", "q"}:
            print("Bye!")
            if session:
                session.clear_last_sensor_ctx()
                clear_followup_timestamp(session)
            else:
                reset_session()
            break
        if not query_raw:
            continue

        # 세션 활동 업데이트
        if session:
            session.update_activity()

        try:
            t0 = time.time()

            # 0) 상세 재요청이면 직전 센서 컨텍스트 출력
            detail_ans = show_last_detail_if_any(query_raw, session)
            if detail_ans:
                print(f"\n{detail_ans}")
                if ENABLE_CHATLOG_SAVE:
                    if session:
                        turn_id = session.increment_turn()
                        session.add_to_history(query_raw, detail_ans, "sensor")
                        save_turn_to_s3(session.session_id, turn_id, "sensor", query_raw, detail_ans, top_docs=[])
                    else:
                        TURN_ID += 1
                        HISTORY.append({"query": query_raw, "answer": detail_ans, "route": "sensor"})
                        save_turn_to_s3(SESSION_ID, TURN_ID, "sensor", query_raw, detail_ans, top_docs=[])
                continue

            # 0-1) 시간별 평균 요청이면 houravg 데이터로 처리 (임시 비활성화 - LLM 응답 위해)
            # hourly_ans = show_hourly_average_if_requested(query_raw)
            # if hourly_ans:
            #     print(f"\n{hourly_ans}")
            #     if ENABLE_CHATLOG_SAVE:
            #         if session:
            #             turn_id = session.increment_turn()
            #             session.add_to_history(query_raw, hourly_ans, "sensor")
            #             save_turn_to_s3(session.session_id, turn_id, "sensor", query_raw, hourly_ans, top_docs=[])
            #         else:
            #             TURN_ID += 1
            #             HISTORY.append({"query": query_raw, "answer": hourly_ans, "route": "sensor"})
            #             save_turn_to_s3(SESSION_ID, TURN_ID, "sensor", query_raw, hourly_ans, top_docs=[])
            #     continue

            # 0-2) 일간 요약 요청이면 houravg 데이터로 처리 (임시 비활성화 - LLM 응답 위해)
            # daily_ans = show_daily_summary_if_requested(query_raw)
            # if daily_ans:
            #     print(f"\n{daily_ans}")
            #     if ENABLE_CHATLOG_SAVE:
            #         if session:
            #             turn_id = session.increment_turn()
            #             session.add_to_history(query_raw, daily_ans, "sensor")
            #             save_turn_to_s3(session.session_id, turn_id, "sensor", query_raw, daily_ans, top_docs=[])
            #         else:
            #             TURN_ID += 1
            #             HISTORY.append({"query": query_raw, "answer": daily_ans, "route": "sensor"})
            #             save_turn_to_s3(SESSION_ID, TURN_ID, "sensor", query_raw, daily_ans, top_docs=[])
            #     continue

            # 0-3) 후속질문이라면 직전 센서 구간을 자동 주입
            query = expand_followup_query_with_last_window(query_raw, session)

            # 1) 라우팅
            route = decide_route(query)

            if route == "general":
                # 세션별 히스토리 사용
                current_history = session.history if session else HISTORY
                prompt = build_general_prompt(query, history=current_history)
                t_gen0 = time.time()
                ans = generate_answer_with_nova(prompt)
                t_gen = time.time() - t_gen0

                print(f"\n{ans}")

                # 히스토리 및 저장 (세션별)
                if session:
                    turn_id = session.increment_turn()
                    session.add_to_history(query_raw, ans, "general")
                    if ENABLE_CHATLOG_SAVE:
                        save_turn_to_s3(session.session_id, turn_id, "general", query_raw, ans, top_docs=[])
                else:
                    TURN_ID += 1
                    HISTORY.append({"query": query_raw, "answer": ans, "route": "general"})
                    if ENABLE_CHATLOG_SAVE:
                        save_turn_to_s3(SESSION_ID, TURN_ID, "general", query_raw, ans, top_docs=[])
                continue

            # 새로운 센서 질문 → 이전 센서 컨텍스트 초기화 (세션별)
            _reset_last_ctx(session)

            # 2) 먼저 S3 로그에서 해당 시간의 센서 데이터 찾기 시도
            # 복수 시간 쿼리는 캐시를 건너뛰고 직접 검색
            dt_strings = extract_datetime_strings(query)
            is_multiple_time_query = len(dt_strings) > 1
            
            cached_sensor_data = None if is_multiple_time_query else find_sensor_data_from_s3_logs(query)
            
            if cached_sensor_data:
                # S3 로그에서 데이터를 찾은 경우
                
                # 캐시된 데이터에서도 타임스탬프를 후속질문용으로 저장 (세션별)
                current_timestamp = get_followup_timestamp(session)
                if not current_timestamp:
                    cached_dt = datetime.strptime(cached_sensor_data['timestamp'], '%Y-%m-%d %H:%M:%S')
                    set_followup_timestamp(cached_dt, session)
                
                # 요청된 필드만 추출해서 응답 생성
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
                    print(f"\n{quick_answer}")
                    
                    # 히스토리 및 저장 (세션별)
                    if session:
                        turn_id = session.increment_turn()
                        session.add_to_history(query_raw, quick_answer, "sensor_cache")
                        if ENABLE_CHATLOG_SAVE:
                            save_turn_to_s3(session.session_id, turn_id, "sensor_cache", query_raw, quick_answer, top_docs=[])
                    else:
                        TURN_ID += 1
                        HISTORY.append({"query": query_raw, "answer": quick_answer, "route": "sensor_cache"})
                        if ENABLE_CHATLOG_SAVE:
                            save_turn_to_s3(SESSION_ID, TURN_ID, "sensor_cache", query_raw, quick_answer, top_docs=[])
                    continue

            # 3) S3 로그에 없으면 기존 방식으로 센서 확정 → S3 검색
            top_docs, context = retrieve_documents_from_s3(query, session=session)
            t_search = time.time() - t0
            if top_docs:
                pass

            # 4) 센서 질의는 항상 RAG + LLM 모드로 처리
            # 검색된 데이터가 있으면 RAG로, 없으면 일반 LLM으로

            # 4) 정확 매칭 실패 → RAG 또는 일반
            # 데이터가 있으면 RAG, 없으면 일반 LLM
            has_sensor_data = top_docs and any(d.get("schema") in {"raw_list","minavg","houravg","mintrend","daily_average","closest_sensor"} or 
                                               any(pattern in d.get("id", "").lower() 
                                                   for pattern in ["rawdata", "houravg", "minavg", "mintrend", "daily_avg"])
                                               for d in top_docs)
            use_rag = has_sensor_data and (top_docs[0]["score"] >= RELEVANCE_THRESHOLD)
            
            print(f"[DEBUG] has_sensor_data: {has_sensor_data}, use_rag: {use_rag}")
            if top_docs:
                print(f"[DEBUG] 첫 번째 문서 스키마: {top_docs[0].get('schema')}, 점수: {top_docs[0].get('score')}")
            
            if use_rag:
                # 세션별 히스토리 사용
                current_history = session.history if session else HISTORY
                prompt = build_prompt(query, context, history=current_history)
                
                # RAG 센서 질문에서 타임스탬프 추출해서 후속질문용으로 저장 (세션별)
                current_timestamp = get_followup_timestamp(session)
                if not current_timestamp:
                    dt_strings = extract_datetime_strings(query)
                    for ds in dt_strings:
                        dt = parse_dt(ds)
                        if dt:
                            set_followup_timestamp(dt, session)
                            break
            else:
                # 세션별 히스토리 사용
                current_history = session.history if session else HISTORY
                prompt = build_general_prompt(query, history=current_history)
                
            t_gen0 = time.time()
            ans = generate_answer_with_nova(prompt)
            t_gen = time.time() - t_gen0
            print(f"\n{ans}")

            # 히스토리 및 저장 (세션별)
            if session:
                turn_id = session.increment_turn()
                session.add_to_history(query_raw, ans, "sensor" if use_rag else "general")
                if ENABLE_CHATLOG_SAVE:
                    save_turn_to_s3(session.session_id, turn_id, "sensor" if use_rag else "general", query_raw, ans, top_docs=top_docs)
            else:
                TURN_ID += 1
                HISTORY.append({"query": query_raw, "answer": ans, "route": "sensor" if use_rag else "general"})
                if ENABLE_CHATLOG_SAVE:
                    save_turn_to_s3(SESSION_ID, TURN_ID, "sensor" if use_rag else "general", query_raw, ans, top_docs=top_docs)

        except Exception:
            pass
            traceback.print_exc()

def main():
    """메인 함수 - 다중 사용자 지원 채팅"""
    import sys
    
    if len(sys.argv) > 1:
        # 세션 ID를 명령행 인수로 받을 수 있음
        session_id = sys.argv[1]
        print(f"세션 ID로 채팅 시작: {session_id}")
        chat_with_session(session_id)
    else:
        # 기본 동작: 새 세션으로 다중 사용자 지원 채팅
        print("다중 사용자 지원 채팅을 시작합니다...")
        chat_with_session()

def main_legacy():
    """기존 방식의 단일 세션 채팅 (하위 호환성)"""
    chat()

if __name__ == "__main__":
    main()