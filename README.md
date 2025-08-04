# 🔍 DevDetective – GitHub Profile Finder & Visual Analyzer

DevDetective is a sleek mini tool to search and analyze any GitHub user’s profile. It shows bio, repos, followers, and visualizes top languages using Chart.js.

## 🚀 Features
- GitHub username search
- Stats: repos, followers, bio, etc.
- Top languages chart (Chart.js)
- Dark/light theme toggle
- Token-based GitHub API access

## ⚙️ Tech Used
HTML, CSS (Tailwind), JavaScript, GitHub REST API, Chart.js

## 🔐 Setup GitHub Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `read:user`, `user:email`
4. Copy the token

➡️ Create `config.js` file and paste:
```js
const GITHUB_TOKEN = "your_token_here";

🛠️ Run Locally
bash
Copy
Edit
git clone https://github.com/sujay-0-dev/-DevDetective
cd devdetective
# Add token to config.js
# Open index.html in browser