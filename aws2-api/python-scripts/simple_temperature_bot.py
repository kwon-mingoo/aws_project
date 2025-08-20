import json
import re
import boto3
from datetime import datetime
from typing import Dict, Optional

# AWS 설정
s3_data = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime', region_name='ap-northeast-2')

S3_BUCKET_DATA = "aws2-airwatch-data"
S3_PREFIX = "minavg/"  # minavg 폴더에서만 검색
MAX_FILES_TO_SCAN = 50  # 적절한 파일 수
INFERENCE_PROFILE_ARN = "arn:aws:bedrock:ap-northeast-2:070561229682:inference-profile/apac.anthropic.claude-sonnet-4-20250514-v1:0"

def extract_external_conditions(query: str) -> dict:
    """외부 온도, 습도, 공기질 정보를 추출하는 함수"""
    external_data = {}
    
    # 외부 온도 추출 (예: "외부 온도 28도", "외부온도는 30도")
    temp_patterns = [
        r"외부\s*온도[는은]?\s*(\d+(?:\.\d+)?)\s*도",
        r"밖\s*온도[는은]?\s*(\d+(?:\.\d+)?)\s*도", 
        r"실외\s*온도[는은]?\s*(\d+(?:\.\d+)?)\s*도"
    ]
    for pattern in temp_patterns:
        match = re.search(pattern, query)
        if match:
            external_data['temperature'] = float(match.group(1))
            break
    
    # 외부 습도 추출 (예: "외부 습도 70%", "밖 습도는 65%")
    humidity_patterns = [
        r"외부\s*습도[는은]?\s*(\d+(?:\.\d+)?)\s*%?",
        r"밖\s*습도[는은]?\s*(\d+(?:\.\d+)?)\s*%?",
        r"실외\s*습도[는은]?\s*(\d+(?:\.\d+)?)\s*%?"
    ]
    for pattern in humidity_patterns:
        match = re.search(pattern, query)
        if match:
            external_data['humidity'] = float(match.group(1))
            break
    
    return external_data

def find_current_indoor_temperature() -> Optional[Dict]:
    """S3_BUCKET_DATA에서 현재 시간 기준 가장 가까운 센서 데이터를 찾는 함수"""
    try:
        current_time = datetime.now()
        #print(f"[DEBUG] 현재 시간: {current_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 빠른 방법: 현재 시간부터 역추적해서 첫 번째 존재하는 파일 찾기
        from datetime import timedelta
        
        #print(f"[DEBUG] 현재 시간부터 역추적해서 가장 가까운 파일 검색 중...")
        
        
        # 1차: 현재 시간부터 50분 전까지 빠르게 확인
        for minutes_back in range(0, 50):
            target_time = current_time - timedelta(minutes=minutes_back)
            file_path = f"minavg/{target_time.year:04d}/{target_time.month:02d}/{target_time.day:02d}/{target_time.hour:02d}/{target_time.year:04d}{target_time.month:02d}{target_time.day:02d}{target_time.hour:02d}{target_time.minute:02d}_minavg.json"
            
            try:
                # HEAD 요청으로 파일 존재 여부만 빠르게 확인
                s3_data.head_object(Bucket=S3_BUCKET_DATA, Key=file_path)
                
                # 파일이 존재하면 내용 가져오기
                file_response = s3_data.get_object(Bucket=S3_BUCKET_DATA, Key=file_path)
                file_content = file_response['Body'].read().decode('utf-8')
                #print(f"[DEBUG] 가까운 파일 발견: {file_path} (현재시간 -{minutes_back}분)")
                
                # 파일에서 최신 데이터 추출
                for line in reversed(file_content.strip().split('\n')):
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                        if 'timestamp' in data and 'mintemp' in data and data['mintemp'] is not None:
                            timestamp_str = data['timestamp']
                            temperature = float(data['mintemp'])
                            
                            #print(f"[DEBUG] 1차 검색 성공: {timestamp_str}, 온도: {temperature}도")
                            
                            return {
                                'timestamp': timestamp_str,
                                'temperature': temperature,
                                'humidity': data.get('minhum'),
                                'gas': data.get('mingas'),
                                'source': f'1차검색 {file_path}',
                                'time_diff_minutes': minutes_back
                            }
                    except json.JSONDecodeError:
                        continue
                        
            except:
                continue  # 파일이 없으면 다음 분 시도
        
        #print("[DEBUG] 1차 검색 실패. 2차: 날짜별로 최신 데이터 검색...")
        
        # 2차: 계층적 검색 (날짜→시간→분 순서로 역추적)
        for days_back in range(0, 10):  # 최대 10일 전까지
            check_date = current_time - timedelta(days=days_back)
            #print(f"[DEBUG] {check_date.strftime('%Y-%m-%d')} 날짜에서 계층적 검색 시작")
            
            # 해당 날짜에 데이터가 있는지 확인
            date_prefix = f"{S3_PREFIX}{check_date.year:04d}/{check_date.month:02d}/{check_date.day:02d}/"
            try:
                response = s3_data.list_objects_v2(
                    Bucket=S3_BUCKET_DATA,
                    Prefix=date_prefix,
                    MaxKeys=1
                )
                if 'Contents' not in response:
                    #print(f"[DEBUG] {check_date.strftime('%Y-%m-%d')} 날짜에 파일 없음 - 다음 날짜로")
                    continue
                    
                #print(f"[DEBUG] {check_date.strftime('%Y-%m-%d')} 날짜에 데이터 존재 - 시간별 검색 시작")
                
                # 시간별로 23시부터 0시까지 역순 검색
                for hour in range(23, -1, -1):
                    hour_prefix = f"{date_prefix}{hour:02d}/"
                    
                    try:
                        hour_response = s3_data.list_objects_v2(
                            Bucket=S3_BUCKET_DATA,
                            Prefix=hour_prefix,
                            MaxKeys=1
                        )
                        if 'Contents' not in hour_response:
                            continue  # 해당 시간에 데이터 없음
                            
                        #print(f"[DEBUG] {check_date.strftime('%Y-%m-%d')} {hour:02d}시에 데이터 존재 - 분별 검색 시작")
                        
                        # 분별로 59분부터 0분까지 역순 검색
                        for minute in range(59, -1, -1):
                            file_key = f"minavg/{check_date.year:04d}/{check_date.month:02d}/{check_date.day:02d}/{hour:02d}/{check_date.year:04d}{check_date.month:02d}{check_date.day:02d}{hour:02d}{minute:02d}_minavg.json"
                            
                            try:
                                # HEAD로 파일 존재 확인
                                s3_data.head_object(Bucket=S3_BUCKET_DATA, Key=file_key)
                                
                                # 파일이 존재하면 내용 가져오기
                                file_response = s3_data.get_object(Bucket=S3_BUCKET_DATA, Key=file_key)
                                file_content = file_response['Body'].read().decode('utf-8')
                                
                                #print(f"[DEBUG] 파일 발견: {file_key}")
                                
                                # 파일에서 가장 최신 데이터 추출 (역순)
                                for line in reversed(file_content.strip().split('\n')):
                                    if not line.strip():
                                        continue
                                    try:
                                        data = json.loads(line)
                                        if 'timestamp' in data and 'mintemp' in data and data['mintemp'] is not None:
                                            timestamp_str = data['timestamp']
                                            temperature = float(data['mintemp'])
                                            data_time = datetime.fromisoformat(timestamp_str)
                                            time_diff = abs((data_time - current_time).total_seconds())
                                            
                                            #print(f"[DEBUG] 계층적 검색 성공: {timestamp_str}, 온도: {temperature}도, 시간차: {int(time_diff/60)}분")
                                            
                                            return {
                                                'timestamp': timestamp_str,
                                                'temperature': temperature,
                                                'humidity': data.get('minhum'),
                                                'gas': data.get('mingas'),
                                                'source': f'계층적검색 {file_key}',
                                                'time_diff_minutes': int(time_diff / 60)
                                            }
                                    except (json.JSONDecodeError, ValueError):
                                        continue
                                        
                            except:
                                continue  # 파일이 없으면 다음 분으로
                                
                    except Exception:
                        continue  # 해당 시간에 문제가 있으면 다음 시간으로
                        
            except Exception as e:
                #print(f"[DEBUG] {check_date.strftime('%Y-%m-%d')} 날짜 검색 실패: {e}")
                continue
        
        #print("[DEBUG] 2차 날짜별 검색 실패. 3차: S3 최신 파일에서 검색...")
        
        # 3차: 기본 방식 폴백
        response = s3_data.list_objects_v2(
            Bucket=S3_BUCKET_DATA,
            Prefix=S3_PREFIX,
            MaxKeys=MAX_FILES_TO_SCAN
        )
        
        if 'Contents' not in response:
            #print("[DEBUG] S3에서 파일을 찾을 수 없습니다.")
            return None
        
        # LastModified 최신 파일부터 확인 (간단하게)
        files = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)
        #print(f"[DEBUG] 3차 검색: S3에서 가장 최근에 저장된 파일 가져오기...")
        
        # 실제 최신 파일들의 정보 출력
        #print("[DEBUG] 실제 S3 최신 파일들:")
        #for i, file in enumerate(files[:10]):
        #   print(f"[DEBUG] {i+1}. {file['Key']} - LastModified: {file['LastModified']}")
        
        for obj in files[:5]:  # 최신 5개 파일만 확인
            try:
                file_response = s3_data.get_object(Bucket=S3_BUCKET_DATA, Key=obj['Key'])
                content = file_response['Body'].read().decode('utf-8')
                
                #print(f"[DEBUG] 3차 검색에서 파일 확인 중: {obj['Key']}")
                
                # 파일에서 가장 최신 데이터만 추출 (역순으로)
                lines = content.strip().split('\n')
                for line in reversed(lines):  # 최신 데이터부터 확인
                    if not line.strip():
                        continue
                        
                    try:
                        data = json.loads(line)
                        
                        if 'timestamp' in data and 'mintemp' in data and data['mintemp'] is not None:
                            timestamp_str = data['timestamp']
                            temperature = float(data['mintemp'])
                            
                            # 시간 차이 계산
                            data_time = datetime.fromisoformat(timestamp_str)
                            time_diff = abs((data_time - current_time).total_seconds())
                            
                            #print(f"[DEBUG] 3차 검색 성공: {timestamp_str}, 온도: {temperature}도, 시간차: {int(time_diff/60)}분")
                            
                            return {
                                'timestamp': timestamp_str,
                                'temperature': temperature,
                                'humidity': data.get('minhum'),
                                'gas': data.get('mingas'),
                                'source': f'3차검색 {obj["Key"]}',
                                'time_diff_minutes': int(time_diff / 60)
                            }
                            
                    except json.JSONDecodeError:
                        continue
                        
            except Exception:
                continue
        
        print("적합한 온도 데이터를 찾지 못했습니다.")
        return None
        
    except Exception as e:
        print(f"Error finding current temperature: {e}")
        return None

def calculate_optimal_temperature(current_temp: float, external_temp: float = None) -> float:
    """현재 온도와 외부 온도를 기준으로 최적 온도 계산"""
    # 기본 최적 온도 계산법: 현재온도가 26도 이상이면 -3도, 24-25도면 -1도, 23도 이하면 +2도
    if current_temp >= 26:
        optimal_temp = current_temp - 3
    elif 24 <= current_temp <= 25:
        optimal_temp = current_temp - 1
    else:  # current_temp <= 23
        optimal_temp = current_temp + 2
    
    # 외부 온도가 주어진 경우 추가 조정 (외부가 더우면 더 시원하게)
    if external_temp:
        if external_temp >= 30:
            optimal_temp -= 1  # 더 시원하게
        elif external_temp <= 20:
            optimal_temp += 1  # 덜 시원하게
    
    return round(optimal_temp, 1)

def build_prompt(query: str, current_data: Dict, external_conditions: Dict = None) -> str:
    """프롬프트 생성"""
    current_time = datetime.now().strftime('%Y년 %m월 %d일 %H시 %M분')
    
    # 센서 데이터 포맷팅
    sensor_info = []
    if current_data.get('temperature'):
        sensor_info.append(f"온도 {current_data['temperature']}도")
    if current_data.get('humidity'):
        sensor_info.append(f"습도 {current_data['humidity']}%")
    if current_data.get('gas'):
        sensor_info.append(f"CO2 {current_data['gas']}ppm")
    
    timestamp_info = ""
    if current_data.get('time_diff_minutes') is not None:
        if current_data['time_diff_minutes'] == 0:
            timestamp_info = " (실시간)"
        else:
            timestamp_info = f" ({current_data['time_diff_minutes']}분 전 측정)"
    
    sensor_text = ", ".join(sensor_info) + timestamp_info
    
    # 외부 조건 포맷팅
    external_text = ""
    if external_conditions:
        external_parts = []
        if external_conditions.get('temperature'):
            external_parts.append(f"외부 온도: {external_conditions['temperature']}도")
        if external_conditions.get('humidity'):
            external_parts.append(f"외부 습도: {external_conditions['humidity']}%")
        external_text = ", ".join(external_parts)
    
    return f"""당신은 스마트 실내환경 어시스턴트입니다. 센서 데이터를 바탕으로 최적의 실내 환경을 추천해주세요.

**현재 시간:** {current_time}

**센서 데이터:** {sensor_text}
{f"**외부 조건:** {external_text}" if external_text else ""}

**사용자 질문:** {query}

**답변 규칙:**
1. 최적 온도 계산법: 
   - 기본: 현재온도가 28도 이상이면 -3도, 24-25도면 -1도, 23도 이하면 +2도
   - 외부 온도 추가 고려: 외부온도가 30도 이상이면 추가로 -1도(더 시원하게), 외부온도가 20도 이하면 추가로 +1도(덜 시원하게)
   - 외부 습도 추가 고려: 외부습도가 70% 이상이면 실내습도를 추가로 -5%(덜 습하게), 외부습도가 30% 이하면 실내습도를 추가로 +5%(덜 건조하게)
   - 외부 CO2 추가 고려: 외부CO2가 500ppm 이상이면 실내CO2를 추가로 -100ppm(더 깨끗하게), 외부CO2가 350ppm 이하면 현재 유지
2. 최적 습도 계산법: 현재습도가 50% 이상이면 -10%, 30% 이하면 +10%, 그외는 현재 유지
3. 최적 공기질 계산법: 현재CO2가 900ppm 이상이면 -400ppm, 그외는 현재 유지
4. 외부 조건이 주어진 경우:
   - 외부 온도만: '현재 실내온도 X도, 외부온도 Y도 기준으로 최적온도는 Z도입니다'
   - 외부 습도만: '현재 실내습도 A%, 외부습도 Y 기준으로 최적습도는 C%입니다'
   - 외부 공기질만: '현재 실내CO2 Cppm, 외부CO2 Yppm 기준으로 최적CO2는 Zppm입니다'
   - 외부 온도+습도: '현재 실내온도 X도(외부 Y도), 실내습도 A%(외부 B%) 기준으로 최적온도는 Z도, 최적습도는 C%입니다'
   - 외부 온도+공기질: '현재 실내온도 X도(외부 Y도), 실내CO2 Cppm(외부 Dppm) 기준으로 최적온도는 Z도, 최적CO2는 Eppm입니다'
   - 외부 습도+공기질: '현재 실내습도 A%(외부 B%), 실내CO2 Cppm(외부 Dppm) 기준으로 최적습도는 C%, 최적CO2는 Eppm입니다'
   - 외부 전체조건: '현재 실내온도 X도(외부 Y도), 실내습도 A%(외부 B%), 실내CO2 Cppm 기준으로 최적온도는 Z도, 최적습도는 D%, 최적CO2는 Eppm입니다'
5. 단순 질문 응답:
   - 현재 온도만 물으면: "27.5도"
   - 현재 습도만 물으면: "58%"  
   - 현재 공기질만 물으면: "720ppm"
6. 최적값 질문 응답:
   - 최적 온도만: "24도"
   - 최적 습도만: "58%"
   - 최적 공기질만: "520ppm"
7. 불필요한 설명 없이 숫자와 단위만 간단히 답변
8. 계산 과정은 절대 넣지마

위 센서 데이터를 참고해서 친절하고 정확한 답변을 해주세요."""

def generate_answer_with_claude(prompt: str) -> str:
    """Claude API를 사용한 답변 생성"""
    try:
        response = bedrock.invoke_model(
            modelId=INFERENCE_PROFILE_ARN,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 512,
                "temperature": 0.0,
                "top_p": 0.9
            })
        )
        
        result = json.loads(response['body'].read().decode('utf-8'))
        return result['content'][0]['text'].strip()
        
    except Exception as e:
        print(f"Claude API 오류: {e}")
        return "답변 생성 중 오류가 발생했습니다."

def generate_response(query: str, current_data: Dict, external_conditions: Dict) -> str:
    """응답 생성 - Claude API 사용"""
    prompt = build_prompt(query, current_data, external_conditions)
    return generate_answer_with_claude(prompt)

def answer_query(query: str) -> str:
    """메인 질문 처리 함수"""
    # 외부 조건 추출
    external_conditions = extract_external_conditions(query)
    
    # 외부 조건이 있으면 무조건 현재 실내 온도 조회
    if external_conditions or "현재" in query or "지금" in query or "실내" in query:
        current_data = find_current_indoor_temperature()
        
        if not current_data:
            return "실내 센서 데이터를 찾을 수 없습니다."
        
        # Claude API로 프롬프트 기반 응답 생성
        return generate_response(query, current_data, external_conditions)
    
    # 기본 경우도 센서 데이터 조회
    current_data = find_current_indoor_temperature()
    if not current_data:
        return "실내 센서 데이터를 찾을 수 없습니다."
        
    return generate_response(query, current_data, {})

def main():
    
    while True:
        try:
            query = input("\n질문을 입력하세요 (종료: quit): ").strip()
            if query.lower() in ['quit', 'exit', 'q']:
                break
            
            if not query:
                continue
                
            answer = answer_query(query)
            print(f"\n{answer}")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"오류: {e}")

if __name__ == "__main__":
    main()