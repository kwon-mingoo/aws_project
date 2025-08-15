/**
 * React 애플리케이션 진입점 (TypeScript)
 * 
 * 백엔드 협업 포인트:
 * - 애플리케이션 초기화 과정에서 백엔드 API 상태 점검
 * - 환경변수로 백엔드 API 엔드포인트 설정 가능
 * - React Router를 통한 SPA 라우팅 (백엔드는 API만 제공)
 */

import React from "react";
import ReactDOM from "react-dom/client";

// 전역 CSS 및 애플리케이션 컴포넌트
import "./index.css";
import App from "./App";

// 클라이언트 사이드 라우팅 설정
// 백엔드는 정적 파일 서빙 시 모든 경로를 index.html로 리다이렉트 필요
import { BrowserRouter } from "react-router-dom";

// 성능 측정 도구 (프로덕션에서 백엔드 모니터링과 연계 가능)
// import reportWebVitals from "./reportWebVitals";

// DOM 루트 요소 확보 및 타입 검증
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("루트 요소를 찾을 수 없습니다. index.html에 <div id='root'></div>가 있는지 확인하세요.");
}

const root = ReactDOM.createRoot(rootElement);

// 애플리케이션 렌더링
root.render(
  <React.StrictMode>
    {/* 
      BrowserRouter 설정:
      - 백엔드 서버는 404 시 index.html을 반환하도록 설정 필요
      - API 엔드포인트(/api/*)는 실제 백엔드 응답 제공
      - 정적 파일(/*, /dashboard 등)은 React 라우터가 처리
    */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// 성능 측정 및 백엔드 모니터링 연계
// reportWebVitals();
