import type {
  ApiProblem,
  IssueListResponse,
  IssueResponse,
  TeamIssue,
  UsersResponse,
} from '../shared/model'

export async function loadUsers(signal?: AbortSignal): Promise<UsersResponse> {
  return requestJson<UsersResponse>('/api/users', signal === undefined ? undefined : { signal })
}

export async function loadIssues(userId: string, signal?: AbortSignal): Promise<IssueListResponse> {
  return requestJson<IssueListResponse>('/api/issues', {
    headers: { 'x-demo-user': userId },
    ...(signal === undefined ? {} : { signal }),
  })
}

export async function updateIssueTitle(
  userId: string,
  issueId: string,
  title: string,
): Promise<IssueResponse> {
  return requestJson<IssueResponse>(`/api/issues/${issueId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-demo-user': userId },
    body: JSON.stringify({ title }),
  })
}

export async function transitionIssue(
  userId: string,
  issue: TeamIssue,
  action: 'close' | 'archive',
): Promise<IssueResponse> {
  return requestJson<IssueResponse>(`/api/issues/${issue.id}/${action}`, {
    method: 'POST',
    headers: { 'x-demo-user': userId },
  })
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  const payload: unknown = await response.json()
  if (!response.ok) {
    const problem = payload as Partial<ApiProblem>
    throw new Error(problem.detail ?? `Request failed with status ${response.status}`)
  }
  return payload as T
}
