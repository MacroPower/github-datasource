import {
  AnnotationEvent,
  DataSourceInstanceSettings,
  MetricFindValue,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  DataFrameView,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { GithubDataSourceOptions, Label, GitHubQuery, GitHubVariableQuery } from './types';
import { ReplaceVariables } from './variables';
import { isValid } from './validation';
import { executeAnnotationQuery } from 'common/standardAnnotationSupport';

export class DataSource extends DataSourceWithBackend<GitHubQuery, GithubDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<GithubDataSourceOptions>) {
    super(instanceSettings);
  }

  templateSrv = getTemplateSrv();

  applyTemplateVariables(query: GitHubQuery, _: ScopedVars): Record<string, any> {
    return ReplaceVariables(this.templateSrv, query);
  }

  async getLabels(repository: string, owner: string, query?: string): Promise<Label[]> {
    return this.getResource('labels', {
      repository,
      owner,
      query,
    });
  }

  async annotationQuery(request: any): Promise<AnnotationEvent[]> {
    return executeAnnotationQuery(request, this, request.annotation)
      .toPromise()
      .then(rsp => {
        return rsp.events ?? [];
      });
  }

  async getChoices(query: GitHubQuery): Promise<string[]> {
    if (!isValid(query)) {
      return [];
    }
    const request = {
      targets: [
        {
          ...query,
          refId: 'metricFindQuery',
        },
      ],
      range: {
        to: {},
        from: {},
      },
    } as DataQueryRequest;

    try {
      const res = await this.query(request).toPromise();
      const columns = res.data[0]?.fields.map((f: any) => f.name) || [];
      return columns;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async metricFindQuery(query: GitHubVariableQuery, options: any): Promise<MetricFindValue[]> {
    if (!isValid(query)) {
      return [];
    }

    const request = {
      targets: [
        {
          ...query,
          refId: 'metricFindQuery',
        },
      ],
      range: options.range,
      rangeRaw: options.rangeRaw,
    } as DataQueryRequest;

    let res: DataQueryResponse;

    try {
      res = await this.query(request).toPromise();
    } catch (err) {
      return Promise.reject(err);
    }

    if (!res || !res.data || res.data.length < 0) {
      return [];
    }

    const view = new DataFrameView(res.data[0] as DataFrame);
    return view.map(item => {
      return {
        text: item[query.field || 'name'],
      };
    });
  }
}
