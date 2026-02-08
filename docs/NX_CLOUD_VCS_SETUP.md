# Connect Nx Cloud to GitHub (HostPulse)

This workspace is linked to Nx Cloud. To resolve **"Missing VCS provider"** and connect your runs to the GitHub repo, complete the steps below.

## Repository

- **URL:** https://github.com/patrickoluoch92-stack/HostPulse.git  
- **Git remote:** `origin` should point to the URL above (run `git remote -v` to verify).

## 1. Install the Nx Cloud GitHub App (recommended)

1. Open [Nx Cloud GitHub App on GitHub Marketplace](https://github.com/marketplace/official-nx-cloud-app).
2. Click **Install** and choose the **patrickoluoch92-stack** account (or the org that owns HostPulse).
3. Select the **HostPulse** repository (or "All repositories").
4. Complete the installation.

## 2. Connect the workspace in Nx Cloud

1. Sign in at [cloud.nx.app](https://cloud.nx.app).
2. Open your workspace (the one with the `nxCloudId` in `nx.json`).
3. Go to **Workspace settings** → **VCS Integrations** (you must be an admin).
4. Under **GitHub**:
   - **Option A:** Select **Use GitHub application** and click **Connect** (recommended if you installed the app).
   - **Option B:** Use a [Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) with repo access, then paste it and click **Connect**.
5. After a successful connection, Nx Cloud will link runs to your repo and the "Missing VCS provider" message will be resolved.

## 3. Verify

- Push a commit or open a PR; Nx Cloud should associate the run with the repo.
- In Nx Cloud, runs should show the correct branch/PR and link to the GitHub repository.

## References

- [Nx Cloud – GitHub Integration](https://nx.dev/docs/guides/nx-cloud/source-control-integration/github)
- [Nx Cloud GitHub App](https://github.com/marketplace/official-nx-cloud-app)
