class DevDetective {
  constructor() {
    // GitHub API configuration
    this.API_BASE_URL = "https://api.github.com"
    // Optional: Add your GitHub token for higher rate limits
    // Get a token from: https://github.com/settings/tokens
    this.GITHUB_TOKEN = "" // Leave empty for public access (60 requests/hour)

    // DOM elements
    this.searchInput = document.getElementById("search-input")
    this.searchBtn = document.getElementById("search-btn")
    this.themeToggle = document.getElementById("theme-toggle")
    this.loading = document.getElementById("loading")
    this.error = document.getElementById("error")
    this.profileContainer = document.getElementById("profile-container")
    this.initialState = document.getElementById("initial-state")
    this.retryBtn = document.getElementById("retry-btn")

    // Chart instances
    this.languagesChart = null
    this.reposChart = null

    // Current user data
    this.currentUser = null
    this.currentRepos = []

    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadTheme()
    this.setupSuggestions()
  }

  setupEventListeners() {
    // Search functionality
    this.searchBtn.addEventListener("click", () => this.handleSearch())
    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleSearch()
      }
    })

    // Theme toggle
    this.themeToggle.addEventListener("click", () => this.toggleTheme())

    // Retry button
    this.retryBtn.addEventListener("click", () => this.handleSearch())

    // Input validation
    this.searchInput.addEventListener("input", (e) => {
      const value = e.target.value.trim()
      this.searchBtn.disabled = value.length === 0
    })
  }

  setupSuggestions() {
    const suggestionBtns = document.querySelectorAll(".suggestion-btn")
    suggestionBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const username = btn.dataset.username
        this.searchInput.value = username
        this.handleSearch()
      })
    })
  }

  async handleSearch() {
    const username = this.searchInput.value.trim()
    if (!username) return

    this.showLoading()

    try {
      // Fetch user data and repositories in parallel
      const [userData, reposData] = await Promise.all([this.fetchUserData(username), this.fetchUserRepos(username)])

      this.currentUser = userData
      this.currentRepos = reposData

      await this.displayProfile(userData, reposData)
    } catch (error) {
      console.error("Error fetching user data:", error)
      this.showError(error.message)
    }
  }

  async fetchUserData(username) {
    const headers = {}
    if (this.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${this.GITHUB_TOKEN}`
    }

    const response = await fetch(`${this.API_BASE_URL}/users/${username}`, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("User not found. Please check the username and try again.")
      } else if (response.status === 403) {
        throw new Error("API rate limit exceeded. Please try again later or add a GitHub token.")
      } else {
        throw new Error(`GitHub API error: ${response.status}`)
      }
    }

    return await response.json()
  }

  async fetchUserRepos(username) {
    const headers = {}
    if (this.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${this.GITHUB_TOKEN}`
    }

    const response = await fetch(`${this.API_BASE_URL}/users/${username}/repos?sort=updated&per_page=6`, { headers })

    if (!response.ok) {
      console.warn("Could not fetch repositories")
      return []
    }

    return await response.json()
  }

  async fetchLanguageStats(repos) {
    const languageStats = {}
    const headers = {}
    if (this.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${this.GITHUB_TOKEN}`
    }

    // Limit to first 10 repos to avoid rate limiting
    const reposToAnalyze = repos.slice(0, 10)

    try {
      const languagePromises = reposToAnalyze.map(async (repo) => {
        try {
          const response = await fetch(repo.languages_url, { headers })
          if (response.ok) {
            return await response.json()
          }
        } catch (error) {
          console.warn(`Could not fetch languages for ${repo.name}`)
        }
        return {}
      })

      const languageResults = await Promise.all(languagePromises)

      // Aggregate language statistics
      languageResults.forEach((languages) => {
        Object.entries(languages).forEach(([language, bytes]) => {
          languageStats[language] = (languageStats[language] || 0) + bytes
        })
      })
    } catch (error) {
      console.warn("Error fetching language statistics:", error)
    }

    return languageStats
  }

  async displayProfile(userData, reposData) {
    // Update user information
    this.updateUserInfo(userData)

    // Update statistics
    this.updateStats(userData, reposData)

    // Fetch and display language statistics
    const languageStats = await this.fetchLanguageStats(reposData)
    this.updateLanguagesChart(languageStats)

    // Update repository statistics chart
    this.updateReposChart(reposData)

    // Display recent repositories
    this.displayRecentRepos(reposData)

    // Show profile container
    this.showProfile()
  }

  updateUserInfo(userData) {
    // Avatar and basic info
    document.getElementById("user-avatar").src = userData.avatar_url
    document.getElementById("user-avatar").alt = `${userData.login}'s avatar`
    document.getElementById("user-name").textContent = userData.name || userData.login
    document.getElementById("user-username").textContent = `@${userData.login}`
    document.getElementById("user-bio").textContent = userData.bio || "No bio available"

    // Profile link
    const profileLink = document.getElementById("user-profile-link")
    profileLink.href = userData.html_url

    // Meta information
    document.getElementById("user-location").textContent = userData.location || "Not specified"
    document.getElementById("user-company").textContent = userData.company || "Not specified"

    const blogElement = document.getElementById("user-blog")
    if (userData.blog) {
      blogElement.textContent = userData.blog
      blogElement.href = userData.blog.startsWith("http") ? userData.blog : `https://${userData.blog}`
      blogElement.style.display = "inline"
    } else {
      blogElement.textContent = "Not specified"
      blogElement.removeAttribute("href")
    }

    // Join date
    const joinDate = new Date(userData.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    document.getElementById("user-joined").textContent = `Joined ${joinDate}`
  }

  updateStats(userData, reposData) {
    // Basic stats
    document.getElementById("public-repos").textContent = userData.public_repos.toLocaleString()
    document.getElementById("followers").textContent = userData.followers.toLocaleString()
    document.getElementById("following").textContent = userData.following.toLocaleString()

    // Calculate total stars
    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0)
    document.getElementById("total-stars").textContent = totalStars.toLocaleString()
  }

  updateLanguagesChart(languageStats) {
    const canvas = document.getElementById("languages-chart")
    const noDataElement = document.getElementById("no-languages")

    // Destroy existing chart
    if (this.languagesChart) {
      this.languagesChart.destroy()
    }

    const languages = Object.keys(languageStats)
    if (languages.length === 0) {
      canvas.style.display = "none"
      noDataElement.classList.remove("hidden")
      return
    }

    canvas.style.display = "block"
    noDataElement.classList.add("hidden")

    // Sort languages by usage and take top 8
    const sortedLanguages = Object.entries(languageStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)

    const labels = sortedLanguages.map(([lang]) => lang)
    const data = sortedLanguages.map(([, bytes]) => bytes)
    const colors = this.generateColors(labels.length)

    const ctx = canvas.getContext("2d")
    this.languagesChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: getComputedStyle(document.documentElement).getPropertyValue("--bg-primary"),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue("--text-primary"),
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || ""
                const value = context.parsed
                const total = context.dataset.data.reduce((a, b) => a + b, 0)
                const percentage = ((value / total) * 100).toFixed(1)
                return `${label}: ${percentage}%`
              },
            },
          },
        },
      },
    })
  }

  updateReposChart(reposData) {
    const canvas = document.getElementById("repos-chart")

    // Destroy existing chart
    if (this.reposChart) {
      this.reposChart.destroy()
    }

    // Prepare data for repository statistics
    const publicRepos = reposData.filter((repo) => !repo.private).length
    const forkedRepos = reposData.filter((repo) => repo.fork).length
    const originalRepos = publicRepos - forkedRepos

    const ctx = canvas.getContext("2d")
    this.reposChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Original", "Forked", "Total Public"],
        datasets: [
          {
            label: "Repositories",
            data: [originalRepos, forkedRepos, publicRepos],
            backgroundColor: ["#3b82f6", "#10b981", "#f59e0b"],
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              color: getComputedStyle(document.documentElement).getPropertyValue("--text-secondary"),
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue("--border-color"),
            },
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue("--text-secondary"),
            },
            grid: {
              display: false,
            },
          },
        },
      },
    })
  }

  displayRecentRepos(reposData) {
    const container = document.getElementById("repos-container")
    container.innerHTML = ""

    if (reposData.length === 0) {
      container.innerHTML = '<p class="no-data">No public repositories found.</p>'
      return
    }

    reposData.forEach((repo) => {
      const repoCard = this.createRepoCard(repo)
      container.appendChild(repoCard)
    })
  }

  createRepoCard(repo) {
    const card = document.createElement("div")
    card.className = "repo-card"

    const languageColor = this.getLanguageColor(repo.language)
    const updatedDate = new Date(repo.updated_at).toLocaleDateString()

    card.innerHTML = `
            <div class="repo-header">
                <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="repo-name">
                    ${repo.name}
                </a>
                <span class="repo-visibility">${repo.private ? "Private" : "Public"}</span>
            </div>
            <p class="repo-description">${repo.description || "No description available"}</p>
            <div class="repo-stats">
                ${
                  repo.language
                    ? `
                    <div class="repo-language">
                        <span class="language-dot" style="background-color: ${languageColor}"></span>
                        <span>${repo.language}</span>
                    </div>
                `
                    : ""
                }
                <div class="repo-stat">
                    <span>⭐</span>
                    <span>${repo.stargazers_count}</span>
                </div>
                <div class="repo-stat">
                    <span>🍴</span>
                    <span>${repo.forks_count}</span>
                </div>
                <div class="repo-stat">
                    <span>📅</span>
                    <span>Updated ${updatedDate}</span>
                </div>
            </div>
        `

    return card
  }

  generateColors(count) {
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#ec4899",
      "#6366f1",
    ]

    const result = []
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length])
    }
    return result
  }

  getLanguageColor(language) {
    const languageColors = {
      JavaScript: "#f1e05a",
      TypeScript: "#2b7489",
      Python: "#3572A5",
      Java: "#b07219",
      "C++": "#f34b7d",
      C: "#555555",
      "C#": "#239120",
      PHP: "#4F5D95",
      Ruby: "#701516",
      Go: "#00ADD8",
      Rust: "#dea584",
      Swift: "#ffac45",
      Kotlin: "#F18E33",
      Dart: "#00B4AB",
      HTML: "#e34c26",
      CSS: "#1572B6",
      Vue: "#2c3e50",
      React: "#61DAFB",
      Angular: "#DD0031",
    }

    return languageColors[language] || "#6b7280"
  }

  showLoading() {
    this.hideAllStates()
    this.loading.classList.remove("hidden")
    this.searchBtn.disabled = true
    this.searchBtn.textContent = "Searching..."
  }

  showError(message) {
    this.hideAllStates()
    this.error.classList.remove("hidden")
    document.getElementById("error-message").textContent = message
    this.resetSearchButton()
  }

  showProfile() {
    this.hideAllStates()
    this.profileContainer.classList.remove("hidden")
    this.resetSearchButton()
  }

  hideAllStates() {
    this.loading.classList.add("hidden")
    this.error.classList.add("hidden")
    this.profileContainer.classList.add("hidden")
    this.initialState.classList.add("hidden")
  }

  resetSearchButton() {
    this.searchBtn.disabled = false
    this.searchBtn.innerHTML = '<span class="search-icon">🔍</span>Search'
  }

  toggleTheme() {
    const body = document.body
    const themeIcon = this.themeToggle.querySelector(".theme-icon")

    if (body.classList.contains("dark-theme")) {
      body.classList.remove("dark-theme")
      themeIcon.textContent = "🌙"
      localStorage.setItem("theme", "light")
    } else {
      body.classList.add("dark-theme")
      themeIcon.textContent = "☀️"
      localStorage.setItem("theme", "dark")
    }

    // Update charts if they exist
    setTimeout(() => {
      if (this.languagesChart) {
        this.languagesChart.update()
      }
      if (this.reposChart) {
        this.reposChart.update()
      }
    }, 100)
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("theme")
    const themeIcon = this.themeToggle.querySelector(".theme-icon")

    if (savedTheme === "dark") {
      document.body.classList.add("dark-theme")
      themeIcon.textContent = "☀️"
    } else {
      themeIcon.textContent = "🌙"
    }
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new DevDetective()
  console.log("🚀 DevDetective loaded successfully!")
})
