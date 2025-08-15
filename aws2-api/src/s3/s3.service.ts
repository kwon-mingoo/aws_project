// AWS S3 파일 관리 서비스
// 주요 기능: JSON 파싱, 파일 검색, 날짜 기반 조회

import { Injectable } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME || '';
    if (!this.bucket) throw new Error('S3_BUCKET_NAME is not set');

    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
  }

  /**
   * S3에서 JSON 또는 NDJSON 파일을 읽어서 파싱
   */
  async getJson(key: string) {
    if (!key) throw new Error('key is required');

    console.log(`📥 S3에서 파일 읽기 시작: ${key}`);

    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    const text = await res.Body?.transformToString('utf-8');
    if (!text) throw new Error('Empty S3 object body');

    console.log(`📄 파일 내용 크기: ${text.length} characters`);

    try {
      const parsed = JSON.parse(text);
      console.log(`✅ 일반 JSON으로 파싱 성공`);
      return parsed;
    } catch (jsonError) {
      console.log(`🔄 일반 JSON 파싱 실패, NDJSON으로 시도...`);

      try {
        const lines = text.trim().split('\n');
        const jsonObjects = lines
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line.trim()));

        console.log(`✅ NDJSON으로 파싱 성공: ${jsonObjects.length}개 객체`);
        return jsonObjects;
      } catch (ndjsonError) {
        console.error(`❌ NDJSON 파싱도 실패:`, ndjsonError);
        throw new Error(
          `Failed to parse as JSON or NDJSON: ${jsonError.message}`,
        );
      }
    }
  }

  /**
   * S3 파일 존재 여부 확인
   */
  async checkFileExists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 파일명에서 날짜를 파싱하여 S3 경로 생성 (YYYYMMDDHHMM_raw.json 패턴)
   */
  parseFilenameDatePath(filename: string): string | null {
    const match = filename.match(
      /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})_(raw|rawdata)\.json$/,
    );

    if (!match) {
      console.log(
        `파일명 파싱 실패: ${filename} (YYYYMMDDHHMM_raw.json 또는 YYYYMMDDHHMM_rawdata.json 패턴이 아님)`,
      );
      return null;
    }

    const [, year, month, day, hour] = match;
    const s3Path = `rawdata/${year}/${month}/${day}/${hour}/${filename}`;
    console.log(`파일명 파싱 성공: ${filename} → ${s3Path}`);

    return s3Path;
  }

  /**
   * 파일명으로 S3에서 파일을 지능적으로 검색
   *
   * 검색 전략:
   * 1. 우선순위 1: 파일명 패턴 분석 → 정확한 S3 경로 생성 → 빠른 확인
   * 2. 우선순위 2: 전체 rawdata 폴더 스캔 → 파일명 매칭 → 느리지만 확실
   *
   * 이 2단계 접근법의 장점:
   * - 대부분의 경우 1단계에서 빠르게 찾음 (O(1) 성능)
   * - 예외 상황에서도 2단계로 안전하게 찾음 (O(n) 성능)
   *
   * @param filename 검색할 파일명 (예: "202508081711_raw.json")
   * @returns 찾은 파일의 전체 S3 키 또는 null
   *
   * @example
   * await findFileByName("202508081711_raw.json")
   * // 결과: "rawdata/2025/08/08/14/202508081711_raw.json"
   */
  async findFileByName(filename: string): Promise<string | null> {
    console.log(`파일 검색 시작: ${filename}`);

    // === 1단계: 스마트 검색 (파일명 패턴 분석) ===
    // 파일명이 날짜 패턴(YYYYMMDDHHMM_raw.json)을 따르는지 확인
    console.log('1단계: 파일명 패턴 분석 중...');
    const parsedPath = this.parseFilenameDatePath(filename);

    if (parsedPath) {
      console.log(`파싱된 경로로 직접 확인: ${parsedPath}`);

      // HeadObject로 파일 존재 여부만 확인 (빠르고 비용 효율적)
      const exists = await this.checkFileExists(parsedPath);
      if (exists) {
        console.log(`✅ 1단계에서 파일 발견: ${parsedPath}`);
        return parsedPath;
      } else {
        console.log(`❌ 파싱된 경로에 파일 없음: ${parsedPath}`);
      }
    }

    // === 2단계: 전체 스캔 검색 (Fallback) ===
    // 1단계에서 실패했거나 패턴이 맞지 않는 경우
    console.log('2단계: rawdata 폴더 전체 스캔 중...');

    try {
      // rawdata 프리픽스로 시작하는 모든 객체 조회
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'rawdata/', // rawdata/로 시작하는 모든 파일
        MaxKeys: 1000, // 성능을 위해 최대 1000개로 제한
      });

      const response = await this.s3.send(command);
      const objects = response.Contents || [];

      console.log(`스캔된 객체 수: ${objects.length}개`);

      // 각 S3 객체의 키에서 파일명 부분만 추출하여 비교
      for (const obj of objects) {
        if (obj.Key && obj.Key.endsWith(`/${filename}`)) {
          console.log(`✅ 2단계에서 파일 발견: ${obj.Key}`);
          return obj.Key;
        }
      }

      console.log(`❌ 전체 스캔에서도 파일을 찾지 못함: ${filename}`);
    } catch (error) {
      console.error('S3 파일 검색 중 오류 발생:', error);
      // 에러가 발생해도 null을 반환하여 상위 레벨에서 적절히 처리하도록 함
    }

    return null; // 모든 시도에서 실패
  }

  /**
   * 날짜 범위로 S3 파일들 검색
   * @param startDate 시작 날짜 (YYYY-MM-DD)
   * @param endDate 종료 날짜 (YYYY-MM-DD)
   * @returns 찾은 파일들의 키 배열
   */
  async findFilesByDateRange(
    startDate: string,
    endDate?: string,
  ): Promise<string[]> {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    const foundFiles: string[] = [];
    const currentDate = new Date(start);

    // 날짜별로 검색
    while (currentDate <= end) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');

      const prefix = `rawdata/${year}/${month}/${day}/`;

      try {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000,
        });

        const response = await this.s3.send(command);
        const objects = response.Contents || [];

        for (const obj of objects) {
          if (obj.Key && obj.Key.endsWith('.json')) {
            foundFiles.push(obj.Key);
          }
        }
      } catch (error) {
        console.error(
          `Error searching files for date ${year}-${month}-${day}:`,
          error,
        );
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return foundFiles.sort();
  }

  /**
   * minavg 폴더에서 가장 최신 파일을 찾는 메서드
   *
   * 🔍 검색 방식:
   * - minavg 폴더의 모든 파일을 스캔
   * - LastModified 시간을 기준으로 가장 최신 파일 반환
   *
   * @returns 가장 최신 파일의 S3 키 또는 null (파일이 없는 경우)
   *
   * @example
   * await getLatestMinavgFile()
   * // 결과: "minavg/2025/08/08/17/202508081755_minavg.json"
   */
  async getLatestMinavgFile(): Promise<string | null> {
    console.log('minavg 폴더에서 최신 파일 검색 중...');

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'minavg/',
        MaxKeys: 1000,
      });

      const response = await this.s3.send(command);
      const objects = response.Contents || [];

      // JSON 파일만 필터링하고 LastModified 기준으로 정렬
      const jsonFiles = objects
        .filter((obj) => obj.Key && obj.Key.endsWith('.json'))
        .sort((a, b) => {
          const dateA = a.LastModified?.getTime() || 0;
          const dateB = b.LastModified?.getTime() || 0;
          return dateB - dateA; // 최신 순으로 정렬
        });

      if (jsonFiles.length === 0) {
        console.log('minavg 폴더에 JSON 파일이 없습니다.');
        return null;
      }

      const latestFile = jsonFiles[0].Key!;
      console.log(`✅ 최신 minavg 파일 발견: ${latestFile}`);
      return latestFile;
    } catch (error) {
      console.error('minavg 폴더 검색 중 오류 발생:', error);
      return null;
    }
  }

  /**
   * mintrend 폴더에서 가장 최신 파일을 찾는 메서드
   *
   * 🔍 검색 방식:
   * - mintrend 폴더의 모든 파일을 스캔
   * - LastModified 시간을 기준으로 가장 최신 파일 반환
   *
   * @returns 가장 최신 파일의 S3 키 또는 null (파일이 없는 경우)
   *
   * @example
   * await getLatestMintrendFile()
   * // 결과: "mintrend/2025/08/08/17/202508081755_mintrend.json"
   */
  async getLatestMintrendFile(): Promise<string | null> {
    console.log('mintrend 폴더에서 최신 파일 검색 중...');

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'mintrend/',
        MaxKeys: 1000,
      });

      const response = await this.s3.send(command);
      const objects = response.Contents || [];

      // JSON 파일만 필터링하고 LastModified 기준으로 정렬
      const jsonFiles = objects
        .filter((obj) => obj.Key && obj.Key.endsWith('.json'))
        .sort((a, b) => {
          const dateA = a.LastModified?.getTime() || 0;
          const dateB = b.LastModified?.getTime() || 0;
          return dateB - dateA; // 최신 순으로 정렬
        });

      if (jsonFiles.length === 0) {
        console.log('mintrend 폴더에 JSON 파일이 없습니다.');
        return null;
      }

      const latestFile = jsonFiles[0].Key!;
      console.log(`✅ 최신 mintrend 파일 발견: ${latestFile}`);
      return latestFile;
    } catch (error) {
      console.error('mintrend 폴더 검색 중 오류 발생:', error);
      return null;
    }
  }

  /**
   * 날짜 문자열(YYYYMMDD)로 해당 날짜의 모든 시간대 JSON 파일 조회
   *
   * 🕐 검색 방식:
   * - YYYYMMDD 형식의 날짜로 해당 날짜의 모든 시간대(00~23) 폴더를 검색
   * - 각 시간 폴더에서 JSON 파일들을 수집하여 통합 반환
   *
   * @param dateString 날짜 문자열 (예: "20250808")
   * @param folderType 검색할 폴더 타입 ('rawdata' | 'houravg' | 'minavg' | 'mintrend')
   * @returns 해당 날짜의 모든 JSON 파일 키 배열 (시간순 정렬)
   *
   * @example
   * await getFilesByDate("20250808", "rawdata")
   * // 결과: [
   * //   "rawdata/2025/08/08/00/202508080000_raw.json",
   * //   "rawdata/2025/08/08/01/202508080100_raw.json",
   * //   ...
   * //   "rawdata/2025/08/08/23/202508082300_raw.json"
   * // ]
   */
  async getFilesByDate(
    dateString: string,
    folderType: 'rawdata' | 'houravg' | 'minavg' | 'mintrend' = 'rawdata',
  ): Promise<string[]> {
    // 날짜 형식 검증
    if (!/^\d{8}$/.test(dateString)) {
      throw new Error('Invalid date format. Use YYYYMMDD (e.g., 20250808)');
    }

    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    const allFiles: string[] = [];

    // 모든 시간대(00~23) 검색
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      const prefix = `${folderType}/${year}/${month}/${day}/${hourStr}/`;

      try {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000,
        });

        const response = await this.s3.send(command);
        const objects = response.Contents || [];

        const hourFiles = objects
          .filter((obj) => obj.Key && obj.Key.endsWith('.json'))
          .map((obj) => obj.Key!);

        allFiles.push(...hourFiles);
      } catch (error) {
        console.error(`Error getting files for ${prefix}:`, error);
        // 개별 시간대 에러는 무시하고 계속 진행
      }
    }

    return allFiles.sort();
  }
}
