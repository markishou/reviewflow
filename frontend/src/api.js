import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://v0265h6199.execute-api.us-east-1.amazonaws.com/dev';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('session_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on expired/invalid token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is expired or invalid — clear session and reload
      localStorage.removeItem('reviewflow_user');
      localStorage.removeItem('session_token');
      localStorage.removeItem('github_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Public endpoints (no auth required)
export const getHealth = () => api.get('/api/health');

// Protected endpoints (Cognito auth required)
export const getPrs = (params = {}) => api.get('/api/prs', { params });
export const getUserMe = () => api.get('/api/users/me');

// GitHub OAuth
export const getGitHubAuthUrl = () => {
    const clientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,read:user`;
}
export const handleOAuthCallback = (code) => {
    api.get('/api/auth/github/callback', { params: { code } });
}

// Team management
export const getMyTeam = () => api.get('/api/teams/me');
export const createTeam = (teamName, githubOrg) =>
    api.post('/api/teams', { team_name: teamName, github_org: githubOrg });
export const connectRepo = (repositoryFullName) => 
    api.post('/api/teams/repos', { repository_full_name: repositoryFullName });

export default api;