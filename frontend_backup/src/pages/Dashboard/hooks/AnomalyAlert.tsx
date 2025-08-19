/**
 * ═══════════════════════════════════════════════════════════════
 * 🚨 AnomalyAlert - 실시간 이상치 감지 및 알림 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 기존 S3 API를 사용한 프론트엔드 전용 이상치 감지
 * - 실시간 IoT 센서 데이터 모니터링 (온도, 습도, 가스)
 * - 임계값 기반 자동 알림 생성 (warning/danger 단계)
 * - 비지속적(non-intrusive) 팝업 알림 UI
 * - 알림 대기열 및 자동 숨김 기능
 * - 중복 알림 방지 및 연속 알림 억제
 * 
 * 📄 데이터 소스:
 * - S3 API: /s3/file/last/mintrend (Mintrend 데이터)
 * - 기존 DashboardAPI 호환성 보장
 * - 새로운 백엔드 API 불필요
 * 
 * 🔄 업데이트 주기:
 * - 기본: 60초마다 자동 체크
 * - 사용자 정의 가능 (interval prop)
 * 
 * 🎨 UI 디자인:
 * - 화면 우상단 고정 위치
 * - 심각도별 색상 구분 (warning: 노란색, danger: 빨간색)
 * - 매끄럽게 나타나고 사라지는 애니메이션
 * - 알림 카운터 및 시간 정보 표시
 * 
 * 🛡️ 보안 고려사항:
 * - XSS 방지를 위한 입력값 살청
 * - API 에러 처리 및 예외 상황 대응
 * - 과도한 API 호출 방지
 * 
 * 💡 확장 예정:
 * - 이메일/SMS 알림 연동
 * - 알림 이력 로그 저장
 * - 알림 설정 커스터마이징
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

// 백엔드 API 주소와 키 (env에서 주입)
const API_BASE =
  process.env.REACT_APP_API_BASE_URL || '';
const API_KEY =
  process.env.REACT_APP_ADMIN_API_KEY ||
  process.env.REACT_APP_API_KEY ||
  '';


// ========== 타입 정의 ==========

/**
 * 🌡️ 이상치 감지 대상 센서 타입
 * IoT 시스템에서 모니터링하는 3가지 주요 환경 지표
 */
export type AnomalyType = 'temperature' | 'humidity' | 'gas';

/**
 * 🚨 이상치 심각도 레벨
 * - warning: 주의 단계 (예: 온도 28°C 이상)
 * - danger: 위험 단계 (예: 온도 32°C 이상)
 */
export type AnomalySeverity = 'warning' | 'danger';

/**
 * 📈 이상치 데이터 인터페이스
 * 감지된 이상치에 대한 상세 정보를 포함합니다.
 */
export interface AnomalyData {
  id: string;                    // 고유 식별자 (중복 방지용)
  type: AnomalyType;             // 센서 타입 (temperature/humidity/gas)
  severity: AnomalySeverity;     // 심각도 (warning/danger)
  value: number;                 // 현재 측정값
  threshold: number;             // 위반된 임계값
  message: string;               // 사용자에게 표시할 메시지
  timestamp: string;             // 이상치 발생 시간
  location?: string;             // 센서 위치 (선택사항)
}

/**
 * 🚨 알림 UI 상태 관리 인터페이스
 * 화면에 표시되는 알림의 상태와 데이터를 관리합니다.
 */
interface AnomalyAlert {
  id: string;                    // 알림 고유 ID
  data: AnomalyData;             // 이상치 데이터
  isVisible: boolean;            // 화면 표시 여부 (애니메이션 제어용)
}

/**
 * 📄 S3 API 응답 타입 (기존 Mintrend API 구조 호환)
 * 기존 DashboardScreen에서 사용하는 S3 API와 동일한 구조를 사용합니다.
 * 새로운 백엔드 API를 추가하지 않고도 이상치 감지 기능을 구현할 수 있습니다.
 */
interface S3ApiResponse {
  filename: string;              // S3 파일명
  data: {
    timestamp: string;           // 데이터 수집 시간
    // Mintrend 형식의 데이터 필드
    mintemp?: number;            // 최소 온도 (Mintrend)
    minhum?: number;             // 최소 습도 (Mintrend)
    mingas?: number;             // 최소 가스 (Mintrend)
    // 일반 센서 데이터 필드 (호환성용)
    temperature?: number;        // 현재 온도
    humidity?: number;           // 현재 습도
    gas?: number;                // 현재 가스 농도
    location?: string;           // 센서 위치 정보
  };
}

/**
 * ⚠️ 센서별 임계값 설정 인터페이스
 * 각 센서에 대해 warning과 danger 단계의 최소/최대 임계값을 정의합니다.
 */
interface ThresholdConfig {
  warningMin?: number;           // 주의 단계 최소값 (예: 온도 5°C 이하)
  warningMax?: number;           // 주의 단계 최대값 (예: 온도 28°C 이상)
  dangerMin?: number;            // 위험 단계 최소값 (예: 온도 0°C 이하)
  dangerMax?: number;            // 위험 단계 최대값 (예: 온도 32°C 이상)
}

/**
 * 🌡️ 전체 센서 임계값 설정 인터페이스
 * 모든 IoT 센서에 대한 임계값 설정을 포함합니다.
 */
interface ThresholdSettings {
  temperature: ThresholdConfig;  // 온도 센서 임계값
  humidity: ThresholdConfig;     // 습도 센서 임계값
  gas: ThresholdConfig;          // 가스 센서 임계값
}

/**
 * ⚙️ 기본 임계값 설정
 * 
 * IoT 센서별 기본 임계값들입니다.
 * 사용자가 컴포넌트 props로 커스텀 임계값을 제공하지 않을 경우 사용됩니다.
 * 
 * 🌡️ 온도 임계값 (섭씨):
 * - 주의: 10°C 이하 또는 30°C 이상
 * - 위험: 5°C 이하 또는 35°C 이상
 * 
 * 💧 습도 임계값 (백분율):
 * - 주의: 30% 이하 또는 80% 이상
 * - 위험: 20% 이하 또는 90% 이상
 * 
 * 🌫️ 가스 임계값 (ppm):
 * - 주의: 1000ppm 이상
 * - 위험: 1500ppm 이상
 * - 참고: 가스는 일반적으로 최소값 제한이 없음
 */
const DEFAULT_THRESHOLDS: ThresholdSettings = {
  temperature: {
    warningMin: 10.0,   // 10도 이하 경고 (너무 차가움)
    warningMax: 30.0,   // 30도 이상 경고 (너무 뜨거움)
    dangerMin: 5.0,     // 5도 이하 위험 (극도로 차가움)
    dangerMax: 35.0,    // 35도 이상 위험 (극도로 뜨거움)
  },
  humidity: {
    warningMin: 30.0,   // 30% 이하 경고 (너무 건조)
    warningMax: 80.0,   // 80% 이상 경고 (너무 습함)
    dangerMin: 20.0,    // 20% 이하 위험 (극도로 건조)
    dangerMax: 90.0,    // 90% 이상 위험 (극도로 습함)
  },
  gas: {
    warningMax: 1000.0, // 1000ppm 이상 경고 (공기질 주의)
    dangerMax: 1500.0,  // 1500ppm 이상 위험 (심각한 공기오염)
  },
};

/**
 * 🎨 알림 UI 스타일 정의
 * 
 * React 인라인 스타일로 알림 컴포넌트의 모든 시각적 요소를 정의합니다.
 * CSS-in-JS 방식을 사용하여 외부 CSS 파일 없이도 완전한 스타일링을 제공합니다.
 */
const styles = {
  /**
   * 📍 알림 컨테이너 - 고정 위치 오버레이
   * 화면 우상단에 고정되어 다른 UI 요소를 가리지 않는 비침입적 알림
   */
  alertContainer: {
    position: 'fixed' as const,    // 화면에 고정
    top: '20px',                   // 상단에서 20px 떨어진 위치
    right: '20px',                 // 우측에서 20px 떨어진 위치
    zIndex: 9999,                  // 모든 다른 UI 요소보다 위에 표시
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    pointerEvents: 'none' as const,
    maxWidth: '400px',
    width: '100%',
  },
  alert: {
    pointerEvents: 'auto' as const,
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    borderLeft: '4px solid',
    padding: '16px',
    minHeight: '80px',
    display: 'flex',
    alignItems: 'flex-start' as const,
    gap: '12px',
    animation: 'slideIn 0.3s ease-out',
    transition: 'all 0.2s ease',
    position: 'relative' as const,
  },
  alertWarning: {
    borderLeftColor: '#f59e0b',
    background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
  },
  alertDanger: {
    borderLeftColor: '#dc2626',
    background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
  },
  iconContainer: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    marginTop: '2px',
    color: '#ffffff',
  },
  iconWarning: {
    background: '#fbbf24',
  },
  iconDanger: {
    background: '#dc2626',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 4px 0',
    color: '#111827',
    lineHeight: 1.3,
  },
  message: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '0 0 8px 0',
    lineHeight: 1.4,
  },
  details: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    fontSize: '12px',
  },
  detailItem: {
    background: 'rgba(0, 0, 0, 0.05)',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#374151',
    whiteSpace: 'nowrap' as const,
  },
  closeButton: {
    flexShrink: 0,
    width: '20px',
    height: '20px',
    background: 'transparent',
    border: 'none',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#9ca3af',
    transition: 'all 0.2s ease',
    marginTop: '2px',
  },
  progressBar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    height: '2px',
    background: 'currentColor',
    opacity: 0.3,
    animation: 'progress 5s linear forwards',
  },
};

// CSS 애니메이션을 위한 스타일 태그 추가
const addGlobalStyles = (() => {
  let added = false;
  return () => {
    if (added) return;
    added = true;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes progress {
        from { width: 100%; }
        to { width: 0%; }
      }
      @media (max-width: 640px) {
        .anomaly-alert-container {
          top: 10px !important;
          right: 10px !important;
          left: 10px !important;
          max-width: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  };
})();

// ========== 이상치 감지 훅 ==========
const useAnomalyDetection = (options: {
  interval?: number;
  autoHideDelay?: number;
  s3ApiEndpoint?: string;
  enabled?: boolean;
  thresholds?: Partial<ThresholdSettings>;
  cooldownMs?: number; // 같은 유형 알림 최소 간격(밀리초)
} = {}) => {
  const config = {
    interval: 60000,
    autoHideDelay: 60000,
    s3ApiEndpoint: '/s3/file/last/mintrend',  // 기존 S3 API 사용
    enabled: true,
    ...options,
    thresholds: { ...DEFAULT_THRESHOLDS, ...options.thresholds },
    cooldownMs: options.cooldownMs ?? 180000, // 기본 3분(원하면 숫자 조절)
  };

  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const alertTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastProcessedTimestampRef = useRef<string | null>(null);
  const lastAlertRef = useRef<Map<string, number>>(new Map()); // type:severity → lastShownTime
  const shownKeyRef = useRef<Set<string>>(new Set());      // type:severity:timestamp
  const lastAlertAtRef = useRef<number>(0);                // 마지막 알림 시각(ms)
  const GLOBAL_COOLDOWN_MS = 60000;

  // 기존 S3 API에서 센서 데이터 가져오기
  const fetchSensorData = useCallback(async (): Promise<S3ApiResponse | null> => {
    if (!config.enabled) return null;

    try {
      setIsLoading(true);
      setError(null);

      // 키가 없으면 바로 에러 안내(개발중 원인 파악 쉬움)
      if (!API_KEY) {
        setError('API 키가 없습니다. .env에 REACT_APP_ADMIN_API_KEY(또는 REACT_APP_API_KEY)를 설정하세요.');
        return null;
      }

      // 상대경로면 API_BASE와 합쳐 절대 URL로
      const fullUrl =
        config.s3ApiEndpoint && config.s3ApiEndpoint.startsWith('http')
          ? config.s3ApiEndpoint
          : `${API_BASE}${config.s3ApiEndpoint.startsWith('/') ? '' : '/'}${config.s3ApiEndpoint}`;

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,   // ✅ 오직 1개만 (api-key/X-API-Key/Authorization 등 금지)
        },
      });
      if (!response.ok) throw new Error(`S3 API 호출 실패: ${response.status}`);

      const data: S3ApiResponse = await response.json();
      setLastCheck(new Date().toISOString());

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMessage);
      console.error('S3 센서 데이터 API 호출 오류:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [config.s3ApiEndpoint, config.enabled]);

  // 이상치 감지 로직 (프론트엔드에서 처리)
  const detectAnomalies = useCallback((sensorData: S3ApiResponse['data']): AnomalyData[] => {
    const anomalies: AnomalyData[] = [];
    const { timestamp } = sensorData;

    // 온도 검사
    const temperature = sensorData.mintemp ?? sensorData.temperature;
    if (temperature !== undefined) {
      anomalies.push(...checkValueAnomalies(
        'temperature', temperature, timestamp, config.thresholds.temperature, sensorData.location
      ));
    }

    // 습도 검사
    const humidity = sensorData.minhum ?? sensorData.humidity;
    if (humidity !== undefined) {
      anomalies.push(...checkValueAnomalies(
        'humidity', humidity, timestamp, config.thresholds.humidity, sensorData.location
      ));
    }

    // 가스 검사
    const gas = sensorData.mingas ?? sensorData.gas;
    if (gas !== undefined) {
      anomalies.push(...checkValueAnomalies(
        'gas', gas, timestamp, config.thresholds.gas, sensorData.location
      ));
    }

    return anomalies;
  }, [config.thresholds]);

  // 값별 이상치 검사 함수
  const checkValueAnomalies = useCallback((
    type: AnomalyType,
    value: number,
    timestamp: string,
    thresholds: ThresholdConfig,
    location?: string,
  ): AnomalyData[] => {
    const anomalies: AnomalyData[] = [];
    const units = { temperature: '°C', humidity: '%', gas: 'ppm' };
    const names = { temperature: '온도', humidity: '습도', gas: '가스' };
    const unit = units[type];
    const name = names[type];

    // 위험 수준 검사
    let dangerThreshold: number | undefined;
    let isDangerAbove = false;

    if (thresholds.dangerMin !== undefined && value <= thresholds.dangerMin) {
      dangerThreshold = thresholds.dangerMin;
      isDangerAbove = false;
    } else if (thresholds.dangerMax !== undefined && value >= thresholds.dangerMax) {
      dangerThreshold = thresholds.dangerMax;
      isDangerAbove = true;
    }

    if (dangerThreshold !== undefined) {
      anomalies.push(createAnomalyData(
        type, 'danger', value, dangerThreshold,
        `위험! ${name}가 ${value}${unit}로 ${dangerThreshold}${unit} ${isDangerAbove ? '이상' : '이하'}입니다.`,
        timestamp, location
      ));
      return anomalies; // 위험 수준이면 경고는 체크하지 않음
    }

    // 경고 수준 검사
    let warningThreshold: number | undefined;
    let isWarningAbove = false;

    if (thresholds.warningMin !== undefined && value <= thresholds.warningMin) {
      warningThreshold = thresholds.warningMin;
      isWarningAbove = false;
    } else if (thresholds.warningMax !== undefined && value >= thresholds.warningMax) {
      warningThreshold = thresholds.warningMax;
      isWarningAbove = true;
    }

    if (warningThreshold !== undefined) {
      anomalies.push(createAnomalyData(
        type, 'warning', value, warningThreshold,
        `경고: ${name}가 ${value}${unit}로 ${warningThreshold}${unit} ${isWarningAbove ? '이상' : '이하'}입니다.`,
        timestamp, location
      ));
    }

    return anomalies;
  }, []);

  // 이상치 데이터 생성
  const createAnomalyData = useCallback((
    type: AnomalyType,
    severity: AnomalySeverity,
    value: number,
    threshold: number,
    message: string,
    timestamp: string,
    location?: string,
  ): AnomalyData => {
    const now = new Date();
    const id = `anom_${type}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}_${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    return {
      id, type, severity, value, threshold, message,
      timestamp: new Date(timestamp).toISOString(),
      location,
    };
  }, []);

  const addAlert = useCallback((anomalyData: AnomalyData) => {
    // 같은 타입/심각도별 쿨다운 적용
    const key = `${anomalyData.type}:${anomalyData.severity}`;
    const now = Date.now();
    const last = lastAlertRef.current.get(key) ?? 0;
    if (now - last < config.cooldownMs) {
      // 쿨다운 내 → 이번 알림은 건너뜀
      return;
    }
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newAlert: AnomalyAlert = {
      id: alertId,
      data: anomalyData,
      isVisible: true,
    };

    setAlerts(prev => [...prev, newAlert]);

    const timer = setTimeout(() => {
      hideAlert(alertId);
    }, config.autoHideDelay);

    alertTimersRef.current.set(alertId, timer);
  }, [config.autoHideDelay]);

  const hideAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));

    const timer = alertTimersRef.current.get(alertId);
    if (timer) {
      clearTimeout(timer);
      alertTimersRef.current.delete(alertId);
    }
  }, []);

  // 메인 이상치 감지 프로세스
  const processAnomalies = useCallback(async () => {
    const sensorResult = await fetchSensorData();

    if (!sensorResult?.data) {
      console.log('센서 데이터를 가져올 수 없음');
      return;
    }
    // 같은 timestamp면 이번 사이클은 스킵 (중복 알림 방지)
    const currentTs = sensorResult.data.timestamp;
    console.log('📊 센서 데이터:', sensorResult.data);
    const detectedAnomalies = detectAnomalies(sensorResult.data);

    if (lastProcessedTimestampRef.current === currentTs && detectedAnomalies.length === 0) return;
    lastProcessedTimestampRef.current = currentTs;

    // ② 60초 글로벌 쿨다운: 마지막 알림 이후 60초 지나야 새 알림 허용
    const now = Date.now();
    if (now - lastAlertAtRef.current < GLOBAL_COOLDOWN_MS) return;

    // ③ 중복 키(ref)로 동일 데이터 재표시 차단, 그리고 이번 사이클은 최대 1건만
    for (const anomaly of detectedAnomalies) {
      const key = `${anomaly.type}:${anomaly.severity}:${anomaly.timestamp}`;
      if (shownKeyRef.current.has(key)) continue;
      shownKeyRef.current.add(key);
      addAlert(anomaly);
      lastAlertAtRef.current = now;       // 한 건만 띄우고 종료
      break;
    }
  }, [fetchSensorData, detectAnomalies, addAlert]);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!config.enabled) return;

    // 주기적 실행
    intervalRef.current = setInterval(() => {
      if (document.hidden) return;   // ✅ 탭이 가려져 있으면 호출 스킵
      processAnomalies();
    }, config.interval);


    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      alertTimersRef.current.forEach(timer => clearTimeout(timer));
      alertTimersRef.current.clear();
    };
  }, [config.enabled, config.interval, processAnomalies]);



  return {
    alerts,
    isLoading,
    error,
    lastCheck,
    hideAlert,
    hasActiveAlerts: alerts.length > 0,
    warningCount: alerts.filter(a => a.data.severity === 'warning').length,
    dangerCount: alerts.filter(a => a.data.severity === 'danger').length,
  };
};

// ========== 메인 컴포넌트 ==========
interface AnomalyAlertProps {
  interval?: number;
  autoHideDelay?: number;
  s3ApiEndpoint?: string;
  enabled?: boolean;
  maxAlerts?: number;
  thresholds?: Partial<ThresholdSettings>;
}

const ANOMALY_CONFIG = {
  temperature: { icon: '🌡️', title: '온도 이상', unit: '°C' },
  humidity: { icon: '💧', title: '습도 이상', unit: '%' },
  gas: { icon: '💨', title: '가스 이상', unit: 'ppm' },
} as const;

const AlertItem: React.FC<{
  alert: AnomalyAlert;
  onClose: (id: string) => void;
  autoHideDelay: number;
}> = ({ alert, onClose, autoHideDelay }) => {
  const { data } = alert;
  const config = ANOMALY_CONFIG[data.type];

  const alertStyle = {
    ...styles.alert,
    ...(data.severity === 'warning' ? styles.alertWarning : styles.alertDanger),
  };

  const iconStyle = {
    ...styles.iconContainer,
    ...(data.severity === 'warning' ? styles.iconWarning : styles.iconDanger),
  };

  const formatValue = (value: number): string => `${value.toFixed(1)}${config.unit}`;
  const formatTime = (timestamp: string): string =>
    new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

  return (
    <div style={alertStyle}>
      <div style={iconStyle}>
        <span>{data.severity === 'warning' ? '⚠️' : '🚨'}</span>
      </div>

      <div style={styles.content}>
        <h4 style={styles.title}>{config.icon} {config.title}</h4>
        <p style={styles.message}>{data.message}</p>
        <div style={styles.details}>
          <span style={styles.detailItem}>현재: {formatValue(data.value)}</span>
          <span style={styles.detailItem}>임계값: {formatValue(data.threshold)}</span>
          <span style={styles.detailItem}>{formatTime(data.timestamp)}</span>
          {data.location && <span style={styles.detailItem}>📍 {data.location}</span>}
        </div>
      </div>

      <button
        style={styles.closeButton}
        onClick={() => onClose(alert.id)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
          e.currentTarget.style.color = '#374151';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#9ca3af';
        }}
      >
        ×
      </button>

      <div
        style={{
          ...styles.progressBar,
          color: data.severity === 'warning' ? '#f59e0b' : '#dc2626',
          animationDuration: `${autoHideDelay}ms`,
        }}
      />
    </div>
  );
};

const AnomalyAlert: React.FC<AnomalyAlertProps> = ({
  interval = 60000,
  autoHideDelay = 60000,
  s3ApiEndpoint = '/s3/file/last/mintrend',
  enabled = true,
  maxAlerts = 5,
  thresholds,
}) => {
  const { alerts, hideAlert } = useAnomalyDetection({
    interval,
    autoHideDelay,
    s3ApiEndpoint,
    enabled,
    thresholds,
  });

  // 글로벌 스타일 추가
  useEffect(() => {
    addGlobalStyles();
  }, []);

  if (alerts.length === 0) return null;

  const displayAlerts = alerts.slice(0, maxAlerts);

  return (
    <div style={styles.alertContainer} className="anomaly-alert-container">
      {displayAlerts.map(alert => (
        <AlertItem
          key={alert.id}
          alert={alert}
          onClose={hideAlert}
          autoHideDelay={autoHideDelay}
        />
      ))}
    </div>
  );
};

export default AnomalyAlert;