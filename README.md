# codeforces-mcp-tools
[![smithery badge](https://smithery.ai/badge/nakranimeet2005/codeforces-mcp-tools)](https://smithery.ai/servers/nakranimeet2005/codeforces-mcp-tools)

An enterprise-grade **Model Context Protocol (MCP)** server for the **Codeforces API**. This integration transforms AI agents like **Claude Desktop** and **Cursor** into personalized competitive programming coaches through deep user analytics and smart problem discovery.

**Author:** Meet Nakrani  
**University:** Charusat University

---

## 🌟 Features

This server exposes **11 strictly-typed AI Tools** categorized into four functional domains:

### 1. User & Performance Analytics
* **`get_user_stats`**: Fetches baseline profile data, current rating, and peak performance.
* **`get_recent_activity`**: Retrieves details of the last problem a user attempted.
* **`get_rating_history`**: Tracks rating trajectories over the last 5 contests.
* **`get_best_contest_rank`**: Highlights absolute peak performance, including lowest rank and largest rating jumps.

### 2. Topic & Skill Mapping
* **`get_tag_breakdown`**: Maps unique problem solves across all Codeforces topic tags.
* **`analyze_weak_topics`**: Automatically identifies rarely solved tags to highlight growth areas.

### 3. Problem & Contest Discovery
* **`get_virtual_contest`**: Recommends unplayed, skill-appropriate practice contests based on rating.
* **`get_recommend_problems`**: Fetches unsolved problems tailored to the user's specific "growth zone."
* **`search_problems`**: High-precision search for problems by specific tags and rating ranges.
* **`get_problem_stats`**: View global solve counts to gauge the actual difficulty of a problem.

### 4. Competitive Intelligence
* **`compare_users`**: A head-to-head analytical tool to calculate rating differentials and unique solves between two players.

---

## 🛠️ Tools Summary

For a quick reference, here are all the tools provided by this server:

| Tool | Purpose |
| :--- | :--- |
| `get_user_stats` | Fetches baseline profile data, current rating, and peak performance. |
| `get_recent_activity` | Retrieves details of the last problem a user attempted. |
| `get_tag_breakdown` | Maps unique problem solves across all Codeforces topic tags. |
| `analyze_weak_topics` | Identifies rarely solved tags to highlight growth areas. |
| `get_rating_history` | Tracks rating trajectories over the last 5 contests. |
| `get_best_contest_rank` | Highlights absolute peak performance, lowest contest rank, and largest rating jumps. |
| `get_virtual_contest` | Recommends unplayed, skill-appropriate practice contests. |
| `get_recommend_problems` | Fetches unsolved problems tailored to the user's specific growth zone. |
| `search_problems` | High-precision search for problems by specific tags and rating ranges. |
| `get_problem_stats` | View global solve counts to gauge actual problem difficulty. |
| `compare_users` | A head-to-head analytical tool to calculate rating differentials and unique solves between two players. |

---

## 🔌 Quick Start

### 1. Install via Smithery (Recommended for Claude Desktop)

To install Codeforces MCP Tools for Claude Desktop automatically via [Smithery](https://smithery.ai/servers/nakranimeet2005/codeforces-mcp-tools):

```bash
npx -y @smithery/cli install codeforces-mcp-tools --client claude
```

### 2. Install via npx (Manual)

Alternatively, you can manually add the following to your `claude_desktop_config.json` or Cursor config:
```json
{
  "mcpServers": {
    "codeforces-tools": {
      "command": "npx",
      "args": [
        "-y",
        "codeforces-mcp-tools"
      ]
    }
  }
}
```


## 🛠️ Development

```bash
npm install
npm run build
```

* **Main Entry:** `server.ts`
* **Compiled Output:** `dist/server.js` (CommonJS)

## 📋 License & Disclaimer
* **License:** ISC
* **Disclaimer:** This is an unofficial project and is not affiliated with Codeforces. Use responsibly within API rate limits.
