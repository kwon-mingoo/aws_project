// /**
//  * ==================================================================================
//  * 메인 진입 컴포넌트 (Frontend - Backend 초기 점검 API 협업 중심)
//  * ==================================================================================
//  * 
//  * 백엔드 API 연동 개요:
//  * 이 컴포넌트는 앱 최초 진입 시 시스템 상태 점검을 위해 백엔드와 통신합니다:
//  * 
//  * API 호출 플로우:
//  * 1) POST /api/main/enter - 진입 이벤트 전송 및 시스템 상태 확인
//  *    - 파라미터: event, timestamp, deviceInfo
//  *    - 응답: status, sensorConnected, delay, nextPage, errorMessage
//  * 
//  * 2) 응답에 따른 화면 전환:
//  *    - status="ready" + sensorConnected=true → delay(ms) 후 Dashboard로 자동 이동
//  *    - status="initializing" → 대기 상태 표시
//  *    - status="error" → 에러 메시지 표시 및 재시도 버튼 제공
//  */

// import React, { useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Main.css";

// interface MainScreenProps {
//   onNavigateToDashboard: () => void; // ✅ App에서 넘기는 prop
// }

// const MainScreen: React.FC<MainScreenProps> = ({ onNavigateToDashboard }) => {
//   return (
//     <div>
//       {/* ... 기존 내용 ... */}
//       {/* 역할 선택 화면으로 넘기는 버튼/링크에서 이 함수 호출 */}
//       <button onClick={onNavigateToDashboard}>Get Started</button>
//       {/* 또는 기존의 시작/다음 버튼 onClick에 교체 */}
//     </div>
//   );
// };

// export default MainScreen;

// export default function Main() {
//   const nav = useNavigate();

//   /**
//    * 컴포넌트 마운트 시 강제로 Dashboard로 이동
//    */
//   useEffect(() => {
//     console.log('🚀 Main 컴포넌트 마운트됨 - 즉시 Dashboard로 이동');
    
//     // 강제로 1초 후 Dashboard로 이동
//     const timer = setTimeout(() => {
//       console.log('⏰ Dashboard로 이동 중...');
//       nav("/dashboard", { replace: true });
//     }, 1000);

//     return () => {
//       clearTimeout(timer);
//     };
//   }, [nav]);

//   /**
//    * ==================================================================================
//    * UI 렌더링 (백엔드 API 상태에 따른 화면 표시)
//    * ==================================================================================
//    * 
//    * 백엔드 연동 포인트:
//    * - state.loading: enterMainView() API 호출 진행 상태
//    * - state.status: 백엔드 응답의 status 필드 ("ready"/"initializing"/"error")
//    * - state.error: 백엔드 응답의 errorMessage 또는 클라이언트 에러 메시지
//    */
//   return (
//     <main className="main">
//       <section className="branding">
//         {/* 
//           메인 브랜드 이미지 (백엔드와 무관, 정적 리소스)
//           - public/images/logo1.png 경로의 로고 이미지
//           - API 호출과 관계없이 즉시 표시
//         */}
//         <img
//           className="brand-image"
//           src="/images/logo1.png"
//           alt="AWS² GiOT Main"
//           draggable="false"
//         />

//         {/* 
//           백엔드 API 상태에 따른 메시지 표시
//           - state는 enterMainView() API 응답 결과를 반영
//         */}
//         <div className="status">
//           <div>시스템을 시작하고 있습니다...</div>
//           <div>잠시만 기다려주세요.</div>
          
//           {/* 로딩 스피너 */}
//           <img
//             className="status-graphic"
//             src="/images/spinner.gif"
//             alt="로딩 중"
//             width={64}
//             height={64}
//             loading="eager"
//             draggable="false"
//           />
//         </div>
//       </section>
//     </main>
//   );
// }


/**
 * ==================================================================================
 * 메인 진입 컴포넌트 (Frontend - Backend 초기 점검 API 협업 중심)
 * ==================================================================================
 * 
 * 백엔드 API 연동 개요:
 * - 앱 최초 진입 시 시스템 상태 점검을 위해 백엔드와 통신 (설계 포인트)
 * - 현재는 데모용으로 버튼 클릭 또는 1초 후 자동 이동만 구현
 */

import React, { useEffect } from "react";
import styles from "./MainScreen.module.css";

interface MainScreenProps {
  onNavigateToDashboard: () => void; // ✅ App에서 넘기는 prop
}

const MainScreen: React.FC<MainScreenProps> = ({ onNavigateToDashboard }) => {
  // (선택) 1초 후 자동 이동을 원하면 활성화
  useEffect(() => {
    const timer = setTimeout(() => {
      onNavigateToDashboard();       // ✅ 라우터 대신 App의 상태 전환 콜백 사용
    }, 1000);
    return () => clearTimeout(timer);
  }, [onNavigateToDashboard]);

  return (
    <main className={styles.main}>
      <section className={styles.branding}>
        <img
          className={styles.brandImage}
          src="/images/logo1.png"
          alt="AWS² GiOT Main"
          draggable="false"
        />

        <div className={styles.status}>
          <div>시스템을 시작하고 있습니다...</div>
          <div>잠시만 기다려주세요.</div>

          <img
            className={styles.statusGraphic}
            src="/images/spinner.gif"
            alt="로딩 중"
            width={64}
            height={64}
            loading="eager"
            draggable="false"
          />
        </div>

        {/* 수동 이동 버튼(테스트용) */}
        <button onClick={onNavigateToDashboard} className={styles.startBtn}>
          Get Started
        </button>
      </section>
    </main>
  );
};

export default MainScreen; // ✅ default export는 오직 한 번만
