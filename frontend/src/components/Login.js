import React from "react";
import { getGitHubAuthUrl } from "../api";

function Login() {
  const handleLogin = () => {
    window.location.href = getGitHubAuthUrl();
  };

  return (
    <div className="min-h-screen bg-rf-bg-primary flex items-center justify-center">
      <div className="bg-rf-bg-secondary rounded-2xl p-10 max-w-md w-full mx-4 border border-rf-border text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rf-accent to-rf-accent-blue flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-2xl font-bold text-rf-text-primary tracking-tight">
            ReviewFlow
          </span>
        </div>

        {/* Tagline */}
        <h1 className="text-xl font-semibold text-rf-text-primary mb-2">
          Code review, orchestrated.
        </h1>
        <p className="text-rf-text-secondary text-sm mb-8 leading-relaxed">
          Intelligent PR routing, priority scoring, and workload balancing for
          teams using AI coding tools.
        </p>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full py-3 px-6 rounded-lg bg-white text-gray-900 font-semibold text-sm 
                        hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Sign in with GitHub
        </button>

        {/* Footer */}
        <p className="text-rf-text-muted text-xs mt-6">
          By signing in, you authorize ReviewFlow to access your repositories.
        </p>
      </div>
    </div>
  );
}

export default Login;
