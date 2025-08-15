/**
 * Create React App 환경변수 타입 선언
 * process.env에서 REACT_APP_ 환경변수들의 타입을 정의합니다.
 */

// process 전역 객체 선언
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly REACT_APP_API_BASE?: string;
    }
  }

  declare module '*.less' {
  const resource: {[key: string]: string};
  export = resource;
}
  
  var process: {
    env: {
      REACT_APP_API_BASE?: string;
      [key: string]: string | undefined;
    };
  };
}

export {};