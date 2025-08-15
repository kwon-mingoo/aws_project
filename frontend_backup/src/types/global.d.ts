// frontend/src/global.d.ts

// CSS Modules (.module.css / .module.scss) — default export 객체
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// Global CSS/Sass — 바인딩 없이 사이드이펙트 import 허용
declare module '*.css';
declare module '*.scss';

// (옵션) 이미지/아이콘 임포트 타입
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg' {
  import * as React from 'react';
  const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  export { ReactComponent };
  const src: string;
  export default src;
}
