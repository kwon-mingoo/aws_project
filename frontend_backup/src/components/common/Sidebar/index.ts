/**
 * ═══════════════════════════════════════════════════════════════
 * 📦 Sidebar 모듈 - 통합 Export 파일
 * ═══════════════════════════════════════════════════════════════
 * 
 * 사이드바 관련 모든 컴포넌트와 타입을 하나의 진입점으로 제공합니다.
 * 다른 파일에서 사이드바를 사용할 때 이 파일을 통해 필요한 요소들을 임포트할 수 있습니다.
 * 
 * 사용 예시:
 * ```tsx
 * import { Sidebar, SidebarProps, MenuItem } from 'components/common/Sidebar';
 * ```
 * 
 * Export 내용:
 * - Sidebar: 메인 사이드바 컴포넌트 (default export)
 * - SidebarTypes: 모든 타입 정의들 (named exports)
 */

// 메인 사이드바 컴포넌트를 기본 export로 재내보내기
export { default as Sidebar } from './Sidebar';

// 모든 타입 정의들을 named export로 재내보내기
export * from './SidebarTypes';