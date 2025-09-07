/**
 * GitLab API 客户端实现
 */

import type { PlatformApiClient } from "../../shared/types";
import { GITLAB_API_URL } from "./config";
import { retryWithBackoff } from "../../../utils/retry";

export interface GitLabMergeRequest {
  iid: number;
  id: number;
  title: string;
  description: string;
  state: "opened" | "closed" | "locked" | "merged";
  author: {
    id: number;
    username: string;
    name: string;
  };
  source_branch: string;
  target_branch: string;
  project_id: number;
  web_url: string;
}

export interface GitLabIssue {
  iid: number;
  id: number;
  title: string;
  description: string;
  state: "opened" | "closed";
  author: {
    id: number;
    username: string;
    name: string;
  };
  project_id: number;
  web_url: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: {
    id: number;
    username: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_type: string;
  noteable_id: number;
}

export interface GitLabBranch {
  name: string;
  commit: {
    id: string;
    message: string;
    author_name: string;
    author_email: string;
    authored_date: string;
  };
  protected: boolean;
}

export class GitLabApiClient implements PlatformApiClient {
  readonly platform = "gitlab" as const;

  constructor(
    private token: string,
    private projectId: number,
    private baseUrl: string = GITLAB_API_URL,
  ) {}

  private async makeRequest(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await retryWithBackoff(
      async () => {
        return fetch(url, {
          ...options,
          headers: {
            "PRIVATE-TOKEN": this.token,
            "Content-Type": "application/json",
            ...options.headers,
          },
        });
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffFactor: 2,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitLab API error ${response.status}: ${errorText}`);
    }

    return response;
  }

  async getMergeRequest(iid: number): Promise<GitLabMergeRequest> {
    const response = await this.makeRequest(
      `/projects/${this.projectId}/merge_requests/${iid}`,
    );
    return response.json() as Promise<GitLabMergeRequest>;
  }

  async getIssue(iid: number): Promise<GitLabIssue> {
    const response = await this.makeRequest(
      `/projects/${this.projectId}/issues/${iid}`,
    );
    return response.json() as Promise<GitLabIssue>;
  }

  async createComment(
    entityId: number,
    body: string,
    entityType: "merge_request" | "issue",
  ): Promise<GitLabNote> {
    const endpoint =
      entityType === "merge_request"
        ? `/projects/${this.projectId}/merge_requests/${entityId}/notes`
        : `/projects/${this.projectId}/issues/${entityId}/notes`;

    const response = await this.makeRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({ body }),
    });

    return response.json() as Promise<GitLabNote>;
  }

  async updateComment(
    noteId: number,
    body: string,
    entityId?: number,
    entityType?: "merge_request" | "issue",
  ): Promise<GitLabNote> {
    if (!entityId || !entityType) {
      throw new Error(
        "entityId and entityType are required for GitLab updateComment",
      );
    }
    const endpoint =
      entityType === "merge_request"
        ? `/projects/${this.projectId}/merge_requests/${entityId}/notes/${noteId}`
        : `/projects/${this.projectId}/issues/${entityId}/notes/${noteId}`;

    const response = await this.makeRequest(endpoint, {
      method: "PUT",
      body: JSON.stringify({ body }),
    });

    return response.json() as Promise<GitLabNote>;
  }

  async createBranch(branchName: string, ref: string): Promise<GitLabBranch> {
    const response = await this.makeRequest(
      `/projects/${this.projectId}/repository/branches`,
      {
        method: "POST",
        body: JSON.stringify({
          branch: branchName,
          ref,
        }),
      },
    );

    return response.json() as Promise<GitLabBranch>;
  }

  async commitFiles(
    branchName: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<any> {
    const actions = files.map((file) => ({
      action: "create",
      file_path: file.path,
      content: file.content,
    }));

    const response = await this.makeRequest(
      `/projects/${this.projectId}/repository/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          branch: branchName,
          commit_message: message,
          actions,
        }),
      },
    );

    return response.json();
  }

  async getProject(): Promise<any> {
    const response = await this.makeRequest(`/projects/${this.projectId}`);
    return response.json();
  }

  async getBranches(): Promise<GitLabBranch[]> {
    const response = await this.makeRequest(
      `/projects/${this.projectId}/repository/branches`,
    );
    return response.json() as Promise<GitLabBranch[]>;
  }

  async getDefaultBranch(): Promise<string> {
    const project = (await this.getProject()) as any;
    return project.default_branch;
  }

  async getUserPermissions(): Promise<any> {
    const response = await this.makeRequest(`/projects/${this.projectId}`);
    const project = (await response.json()) as any;
    return project.permissions;
  }
}
