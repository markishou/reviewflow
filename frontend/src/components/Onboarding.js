import React, { useState } from "react";
import { createTeam, connectRepo } from "../api";

function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState("");
  const [githubOrg, setGithubOrg] = useState(user?.github_username || "");
  const [repoName, setRepoName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teamId, setTeamId] = useState(null);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName || !githubOrg) return;

    setLoading(true);
    setError(null);
    try {
      const res = await createTeam(teamName, githubOrg);
      const team = res.data?.data?.team;
      setTeamId(team?.team_id);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectRepo = async (e) => {
    e.preventDefault();
    if (!repoName) return;

    const fullName = repoName.includes("/")
      ? repoName
      : `${githubOrg}/${repoName}`;

    setLoading(true);
    setError(null);
    try {
      await connectRepo(fullName);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    onComplete(teamId);
  };

  return (
    <div className="min-h-screen bg-rf-bg-primary flex items-center justify-center">
      <div className="bg-rf-bg-secondary rounded-2xl p-10 max-w-lg w-full mx-4 border border-rf-border">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rf-accent to-rf-accent-blue flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="text-2xl font-bold text-rf-text-primary tracking-tight">
            ReviewFlow
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                ${step >= s ? "bg-rf-accent text-white" : "bg-rf-bg-tertiary text-rf-text-muted"}`}
              >
                {step > s ? "✓" : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-8 h-0.5 ${step > s ? "bg-rf-accent" : "bg-rf-bg-tertiary"}`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rf-accent-danger/10 border border-rf-accent-danger/30 text-rf-accent-danger text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Create Team */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-rf-text-primary text-center mb-2">
              Create your team
            </h2>
            <p className="text-sm text-rf-text-secondary text-center mb-6">
              Set up your team to start tracking code reviews.
            </p>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs text-rf-text-secondary mb-1.5 uppercase tracking-wider">
                  Team Name
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-rf-border bg-rf-bg-tertiary text-rf-text-primary text-sm outline-none focus:border-rf-accent-blue/50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-rf-text-secondary mb-1.5 uppercase tracking-wider">
                  GitHub Organization / Username
                </label>
                <input
                  type="text"
                  value={githubOrg}
                  onChange={(e) => setGithubOrg(e.target.value)}
                  placeholder="e.g. markhou"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-rf-border bg-rf-bg-tertiary text-rf-text-primary text-sm outline-none focus:border-rf-accent-blue/50"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-rf-accent text-white font-semibold text-sm hover:bg-rf-accent/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Team"}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Connect Repo */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold text-rf-text-primary text-center mb-2">
              Connect a repository
            </h2>
            <p className="text-sm text-rf-text-secondary text-center mb-6">
              Choose a GitHub repo to monitor for pull requests.
            </p>

            <form onSubmit={handleConnectRepo} className="space-y-4">
              <div>
                <label className="block text-xs text-rf-text-secondary mb-1.5 uppercase tracking-wider">
                  Repository Name
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-rf-text-muted">
                    {githubOrg} /
                  </span>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="e.g. reviewflow"
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-rf-border bg-rf-bg-tertiary text-rf-text-primary text-sm outline-none focus:border-rf-accent-blue/50"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-rf-accent text-white font-semibold text-sm hover:bg-rf-accent/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Connect Repository"}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full py-2 text-rf-text-muted text-sm hover:text-rf-text-secondary transition-colors"
              >
                Skip for now
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Configure Webhook */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold text-rf-text-primary text-center mb-2">
              Configure webhook
            </h2>
            <p className="text-sm text-rf-text-secondary text-center mb-6">
              Set up a GitHub webhook to receive PR events.
            </p>

            <div className="bg-rf-bg-primary rounded-lg p-4 border border-rf-border mb-4 space-y-3">
              <div>
                <div className="text-xs text-rf-text-muted uppercase tracking-wider mb-1">
                  Payload URL
                </div>
                <code className="text-xs text-rf-accent-blue break-all">
                  https://v0265h6199.execute-api.us-east-1.amazonaws.com/dev/webhooks/github
                </code>
              </div>
              <div>
                <div className="text-xs text-rf-text-muted uppercase tracking-wider mb-1">
                  Content Type
                </div>
                <code className="text-xs text-rf-text-primary">
                  application/json
                </code>
              </div>
              <div>
                <div className="text-xs text-rf-text-muted uppercase tracking-wider mb-1">
                  Events
                </div>
                <code className="text-xs text-rf-text-primary">
                  Pull requests
                </code>
              </div>
            </div>

            <div className="text-xs text-rf-text-secondary mb-6 leading-relaxed">
              Go to your repo → Settings → Webhooks → Add webhook. Paste the URL
              above, set content type to{" "}
              <span className="text-rf-text-primary">application/json</span>,
              and select{" "}
              <span className="text-rf-text-primary">Pull requests</span>{" "}
              events.
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-lg bg-rf-accent text-white font-semibold text-sm hover:bg-rf-accent/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Onboarding;
