// AWS QuickSight 대시보드 관리 서비스

import { Injectable } from '@nestjs/common';
import {
  QuickSightClient,
  ListDashboardsCommand,
  DescribeDashboardCommand,
  GenerateEmbedUrlForRegisteredUserCommand,
  GenerateEmbedUrlForAnonymousUserCommand,
  type ListDashboardsCommandInput,
  type DescribeDashboardCommandInput,
  type GenerateEmbedUrlForRegisteredUserCommandInput,
  type GenerateEmbedUrlForAnonymousUserCommandInput,
} from '@aws-sdk/client-quicksight';

export interface EmbedUrlRequest {
  userArn?: string;
  sessionLifetimeInMinutes?: number;
  undoRedoDisabled?: boolean;
  resetDisabled?: boolean;
  allowedDomains?: string[];
}

@Injectable()
export class QuickSightService {
  private readonly quickSightClient: QuickSightClient;
  private readonly awsAccountId: string;
  private readonly namespace: string;

  constructor() {
    this.awsAccountId = process.env.AWS_ACCOUNT_ID || '';
    if (!this.awsAccountId) {
      throw new Error('AWS_ACCOUNT_ID environment variable is required');
    }

    this.namespace = process.env.QUICKSIGHT_NAMESPACE || 'default';

    this.quickSightClient = new QuickSightClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
  }

  /**
   * QuickSight 계정의 모든 대시보드 목록 조회
   */
  async listDashboards(maxResults: number = 50, nextToken?: string) {
    console.log(`📊 대시보드 목록 조회 시작 (maxResults: ${maxResults})`);

    const params: ListDashboardsCommandInput = {
      AwsAccountId: this.awsAccountId,
      MaxResults: Math.min(maxResults, 100),
      ...(nextToken && { NextToken: nextToken }),
    };

    try {
      const command = new ListDashboardsCommand(params);
      const response = await this.quickSightClient.send(command);

      console.log(`✅ 대시보드 목록 조회 성공: ${response.DashboardSummaryList?.length || 0}개 발견`);
      return response;
    } catch (error) {
      console.error('❌ 대시보드 목록 조회 중 오류 발생:', error);
      throw error;
    }
  }

  /**
   * 특정 대시보드의 상세 정보 조회
   */
  async describeDashboard(
    dashboardId: string,
    versionNumber?: number,
    aliasName?: string,
  ) {
    console.log(`🔍 대시보드 상세 조회 시작: ${dashboardId}`);

    const params: DescribeDashboardCommandInput = {
      AwsAccountId: this.awsAccountId,
      DashboardId: dashboardId,
      ...(versionNumber && { VersionNumber: versionNumber }),
      ...(aliasName && { AliasName: aliasName }),
    };

    try {
      const command = new DescribeDashboardCommand(params);
      const response = await this.quickSightClient.send(command);

      console.log(`✅ 대시보드 상세 조회 성공: ${response.Dashboard?.Name}`);
      return response;
    } catch (error) {
      console.error(`❌ 대시보드 상세 조회 중 오류 발생 (${dashboardId}):`, error);
      throw error;
    }
  }

  /**
   * 등록된 사용자용 대시보드 임베드 URL 생성
   */
  async generateEmbedUrlForRegisteredUser(
    dashboardId: string,
    request: EmbedUrlRequest,
  ) {
    console.log(`🔗 등록된 사용자용 임베드 URL 생성 시작: ${dashboardId}`);

    if (!request.userArn) {
      throw new Error('User ARN is required for registered user embed URL');
    }

    const params: GenerateEmbedUrlForRegisteredUserCommandInput = {
      AwsAccountId: this.awsAccountId,
      UserArn: request.userArn,
      ExperienceConfiguration: {
        Dashboard: {
          InitialDashboardId: dashboardId,
          FeatureConfigurations: {
            StatePersistence: {
              Enabled: true,
            },
            ...(request.undoRedoDisabled && {
              SharedView: { Enabled: !request.undoRedoDisabled },
            }),
          },
        },
      },
      SessionLifetimeInMinutes: request.sessionLifetimeInMinutes || 600,
      ...(request.allowedDomains && {
        AllowedDomains: request.allowedDomains,
      }),
    };

    try {
      const command = new GenerateEmbedUrlForRegisteredUserCommand(params);
      const response = await this.quickSightClient.send(command);

      console.log(`✅ 등록된 사용자용 임베드 URL 생성 성공: ${dashboardId}`);
      return response;
    } catch (error) {
      console.error(`❌ 등록된 사용자용 임베드 URL 생성 중 오류 발생 (${dashboardId}):`, error);
      throw error;
    }
  }

  /**
   * 익명 사용자용 대시보드 임베드 URL 생성
   */
  async generateEmbedUrlForAnonymousUser(
    dashboardId: string,
    request: EmbedUrlRequest,
  ) {
    console.log(`🔗 익명 사용자용 임베드 URL 생성 시작: ${dashboardId}`);

    const params: GenerateEmbedUrlForAnonymousUserCommandInput = {
      AwsAccountId: this.awsAccountId,
      Namespace: this.namespace,
      AuthorizedResourceArns: [
        `arn:aws:quicksight:${process.env.AWS_REGION || 'ap-northeast-2'}:${this.awsAccountId}:dashboard/${dashboardId}`,
      ],
      ExperienceConfiguration: {
        Dashboard: {
          InitialDashboardId: dashboardId,
        },
      },
      SessionLifetimeInMinutes: request.sessionLifetimeInMinutes || 60,
      ...(request.allowedDomains && {
        AllowedDomains: request.allowedDomains,
      }),
    };

    try {
      const command = new GenerateEmbedUrlForAnonymousUserCommand(params);
      const response = await this.quickSightClient.send(command);

      console.log(`✅ 익명 사용자용 임베드 URL 생성 성공: ${dashboardId}`);
      return response;
    } catch (error) {
      console.error(`❌ 익명 사용자용 임베드 URL 생성 중 오류 발생 (${dashboardId}):`, error);
      throw error;
    }
  }

  /**
   * AWS 계정 정보 및 설정 반환
   */
  getAccountInfo() {
    return {
      awsAccountId: this.awsAccountId,
      namespace: this.namespace,
      region: process.env.AWS_REGION || 'ap-northeast-2',
    };
  }
}