#!/usr/bin/env node
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express, { Request, Response } from "express";


// 1. Initialize the MCP Server
const server = new McpServer(
    {
        name: "codeforces-mcp-server",
        version: "1.0.0",
    }
);
//1st tool get_user_stats
const UserStateInputSchema = z.object({
    handle: z.string().min(1).describe("The codeForces user handle (e.g., tourist)")
});

// Define a simple interface for the tool input to match the schema
interface GetUserStatsInput {
    handle: string;
}

const getUserStatsToolOptions: any = {
    description: "Fetch complete user profile, rating, rank, and solve counts.",
    inputSchema: UserStateInputSchema,
};
server.registerTool<any, any>(
    "get_user_stats",
    getUserStatsToolOptions,
    async (args: GetUserStatsInput) => {
        const { handle } = args;
        try {
            const response = await axios.get(
                `https://codeforces.com/api/user.info?handles=${handle}`
            );
            if (response.data.status !== "OK") {
                throw new Error("Invalid response from Codeforces API");
            }
            const userData = response.data.result[0];

            return {
                content: [
                    {
                        type: "text" as const, text: JSON.stringify(userData, null, 2)
                    }
                ],
                structuredContent: userData as any,
            };
        }
        catch (error: any) {
            return {
                content: [
                    {
                        type: "text" as const, text: `Failed to fetch user stats: ${error.message}`
                    }
                ],
                isError: true,
            };
        }
    }
);

// 2nd tool get_recent_activity
const RecentActivityInputSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle"),
});

interface GetRecentActivityInput {
    handle: string;
}

const getRecentActivityToolOptions: any = {
    description: "Fetch complete the most recently solved Problem , Contest , Points , Link , Tags, by the user.",
    inputSchema: RecentActivityInputSchema,
};

server.registerTool<any, any>(
    "get_recent_activity",
    getRecentActivityToolOptions,
    async (args: GetRecentActivityInput) => {
        const { handle } = args;

        try {
            const response = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1`);

            if (response.data.status !== "OK" || response.data.result.length === 0) {
                throw new Error("No recent activity found or invalid response");
            }

            const lastProblem = response.data.result[0].problem;
            const problemUrl = `https://codeforces.com/contest/${lastProblem.contestId}/problem/${lastProblem.index}`;


            return {
                content: [
                    { type: "text" as const, text: JSON.stringify({ ...lastProblem, url: problemUrl }, null, 2) },
                ],
                structuredContent: { ...lastProblem, url: problemUrl } as any,
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text" as const, text: `Failed to fetch activity: ${error.message}` },
                ],
                isError: true,
            };
        }
    }
);


//3rd tool Get tag BreakDown
const TagBreakDownInputSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle"),
});

interface GetTagBreakDownInput {
    handle: string;
}

const getTagBreakDownToolOptions: any = {
    description: "Fetch all accepted submissions for a user and calculate how many unique problems they have solved for each topic tag (e.g., dp, math, greedy).",
    inputSchema: TagBreakDownInputSchema,
};

server.registerTool<any, any>(
    "get_tag_breakdown",
    getTagBreakDownToolOptions,
    async (args: GetTagBreakDownInput) => {
        const { handle } = args;

        try {
            const response = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}`);

            if (response.data.status !== "OK") {
                throw new Error("No tag breakdown found or invalid response");
            }

            const submissions = response.data.result;
            const solvedProblems = new Set<string>();
            const tagCounts: Record<string, number> = {};

            for (const sub of submissions) {
                if (sub.verdict === "OK") {
                    const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
                    if (!solvedProblems.has(problemId)) {
                        solvedProblems.add(problemId);

                        for (const tag of sub.problem.tags) {
                            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        }
                    }
                }
            }

            const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
            let markdownTable = `| Tag | Problems Solved |\n| :--- | :--- |\n`;
            for (const [tag, count] of sortedTags) {
                markdownTable += `| **${tag}** | ${count} |\n`;
            }
            return {
                content: [
                    { type: "text" as const, text: markdownTable },
                ],
                structuredContent: tagCounts as any,
            };
        } catch (error: any) {
            return {
                content: [
                    { type: "text" as const, text: `Failed to fetch tag breakdown: ${error.message}` },
                ],
                isError: true,
            };
        }
    }
);


//4th Tool Get Best Contest Rank
const BestContestRankInputSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle"),
});

interface GetBestContestRankInput {
    handle: string;
}

const getBestContestRankToolOptions: any = {
    description: "Fetch the user's best ever performance (highest rank) in a single Codeforces contest.",
    inputSchema: BestContestRankInputSchema,
};

server.registerTool<any, any>(
    "get_best_contest_rank",
    getBestContestRankToolOptions,
    async (args: GetBestContestRankInput) => {
        const { handle } = args;

        try {
            const response = await axios.get(
                `https://codeforces.com/api/user.rating?handle=${handle}`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                }
            );

            if (response.data.status !== "OK") {
                throw new Error("Invalid response from Codeforces API");
            }

            const contests = response.data.result;
            // Handle users who have never competed
            if (contests.length === 0) {
                return {
                    content: [
                        { type: "text" as const, text: `User ${handle} has not participated in any rated Codeforces contests yet.` },
                    ],
                };
            }

            let bestContest = contests[0];
            for (let i = 1; i < contests.length; i++) {
                if (contests[i].rank < bestContest.rank) {
                    bestContest = contests[i];
                }
            }

            // Calculate rating change and add a plus sign if it's positive
            const ratingChange = bestContest.newRating - bestContest.oldRating;
            const ratingChangeStr = ratingChange > 0 ? `+${ratingChange}` : `${ratingChange}`;

            // Convert Unix timestamp to readable date
            const dateStr = new Date(bestContest.ratingUpdateTimeSeconds * 1000).toLocaleDateString();

            const markdownTable = `
| Field | Details |
| :--- | :--- |
| **Contest Name** | ${bestContest.contestName} |
| **Best Rank** | 🏆 **${bestContest.rank}** |
| **Rating Change** | ${ratingChangeStr} (from ${bestContest.oldRating} to ${bestContest.newRating}) |
| **Date** | ${dateStr} |
`;
            return {
                content: [
                    { type: "text" as const, text: markdownTable },
                ],
                structuredContent: bestContest as any,
            };
        } catch (error: any) {
            // THIS IS THE MAGIC LINE: It writes the exact error to your Mac's secret log file
            console.error("🚨 CRITICAL ERROR IN TOOL 4:", error.message);
            if (error.response) {
                console.error("🚨 API Response Data:", error.response.data);
            }

            return {
                content: [
                    { type: "text" as const, text: `Failed to fetch best contest rank: ${error.message}` },
                ],
                isError: true,
            };
        }
    }
);

//5th Tool Analyze Weak Topics
const AnalyzeWeakTopicsInputSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle"),
});

interface AnalyzeWeakTopicsInput {
    handle: string;
}

const analyzeWeakTopicsToolOptions: any = {
    description: "Identify underperforming tags and suggest focus areas based on the user's lowest solve counts.",
    inputSchema: AnalyzeWeakTopicsInputSchema,
};

server.registerTool<any, any>(
    "analyze_weak_topics",
    analyzeWeakTopicsToolOptions,
    async (args: AnalyzeWeakTopicsInput) => {
        const { handle } = args;

        try {
            const response = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                }
            );

            if (response.data.status !== "OK") {
                throw new Error("Invalid response from Codeforces API");
            }

            const submissions = response.data.result;
            const solvedProblems = new Set<string>();
            const tagCounts: Record<string, number> = {};

            for (const sub of submissions) {
                if (sub.verdict === "OK") {
                    const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
                    if (!solvedProblems.has(problemId)) {
                        solvedProblems.add(problemId);

                        for (const tag of sub.problem.tags) {
                            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        }
                    }
                }
            }

            const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

            if (sortedTags.length === 0) {
                return {
                    content: [
                        { type: "text" as const, text: `User ${handle} has not solved any problems yet.` },
                    ],
                };
            }
            let markdownTable = `| Tag | Problems Solved |\n| :--- | :--- |\n`;
            for (const [tag, count] of sortedTags) {
                markdownTable += `| **${tag}** | ${count} |\n`;
            }
            return {
                content: [
                    { type: "text" as const, text: markdownTable },
                ],
                structuredContent: Object.fromEntries(sortedTags) as any,
            };
        } catch (error: any) {
            console.error("🚨 CRITICAL ERROR IN TOOL 5:", error.message);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: The Codeforces API request failed. Tell the user exactly this error message so they can debug it: [${error.message}]`
                    },
                ],
            };
        }
    }
);

//6th Tool  Get Rating History

const RatingHistoryInputSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle"),
});

interface GetRatingHistoryInput {
    handle: string;
}

const getRatingHistoryOptions: any = {
    description: "Fetch the user's rating changes over time, including their latest contest performances and overall rating trajectory.",
    inputSchema: RatingHistoryInputSchema,
};

server.registerTool<any, any>(
    "get_rating_history",
    getRatingHistoryOptions,
    async (args: GetRatingHistoryInput) => {
        const { handle } = args;

        try {
            // Bypassing Cloudflare
            const response = await axios.get(`https://codeforces.com/api/user.rating?handle=${handle}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });

            if (response.data.status !== "OK") {
                throw new Error("Invalid response from Codeforces API");
            }

            const contests = response.data.result;
            if (contests.length === 0) {
                return {
                    content: [
                        { type: "text" as const, text: `User ${handle} has not participated in any rated Codeforces contests yet.` },
                    ],
                };
            }
            const recentContests = contests.slice(-5).reverse();
            let markdownTable = `### 📈 Recent Rating History for ${handle}\n`;
            markdownTable += `| Date | Contest | Rank | Rating Change | New Rating |\n`;
            markdownTable += `| :--- | :--- | :--- | :--- | :--- |\n`;

            for (const contest of recentContests) {
                const dateStr = new Date(contest.ratingUpdateTimeSeconds * 1000).toLocaleDateString();
                const change = contest.newRating - contest.oldRating;
                const changeStr = change > 0 ? `+${change} 🟢` : `${change} 🔴`;
                markdownTable += `| ${dateStr} | ${contest.contestName} | ${contest.rank} | ${changeStr} | ${contest.newRating} |\n`;
            }
            // Calculate some quick stats for the summary
            const maxRating = Math.max(...contests.map((c: any) => c.newRating));
            const totalContests = contests.length;

            markdownTable += `\n**Summary**: 
            *   **Total Contests** ${totalContests}
            *   **Peak Rating**: ${maxRating}
            `
            return {
                content: [
                    { type: "text" as const, text: markdownTable },
                ],
                structuredContent: { history: contests } as any,
            };
        } catch (error: any) {
            console.error("🚨 CRITICAL ERROR IN TOOL 6:", error.message);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: The Codeforces API request failed. Tell the user exactly this error message so they can debug it: [${error.message}]`
                    },
                ],
            };
        }
    }
);

//7 tool Get Virtual Contest
const VirtualContestSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle"),
});

interface GetVirtualContestsInput {
    handle: string;
}

const getVirtualContestOption: any = {
    description: "Suggest custom practice virtual contests based on the user's rating, excluding ones they have already competed in.",
    inputSchema: VirtualContestSchema
}
server.registerTool<any, any>(
    "get_virtual_contest",
    getVirtualContestOption,
    async (args: any) => {
        const { handle } = args as GetVirtualContestsInput;
        const cfHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try {
            // 1. Get user rating
            const userInfoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`, { headers: cfHeaders });
            if (userInfoRes.data.status !== 'OK') {
                throw new Error("Failed to fetch user info");
            }
            const rating = userInfoRes.data.result[0].rating || 1400;

            // 2. Get past contests to exclude ones they've already done
            const userRatingRes = await axios.get(`https://codeforces.com/api/user.rating?handle=${handle}`, { headers: cfHeaders });
            const participatedIds = new Set();
            if (userRatingRes.data.status === 'OK') {
                userRatingRes.data.result.forEach((c: any) => participatedIds.add(c.contestId));
            }

            const contestsRes = await axios.get(`https://codeforces.com/api/contest.list?gym=false`, { headers: cfHeaders });
            if (contestsRes.data.status !== 'OK') {
                throw new Error("Failed to fetch contests");
            }

            let contests = contestsRes.data.result.filter((c: any) => c.phase === "FINISHED" && !participatedIds.has(c.id));

            let targetDivs: string[] = [];
            if (rating < 1400) targetDivs = ["Div. 4", "Div. 3"];
            else if (rating < 1600) targetDivs = ["Div. 3", "Div. 2"];
            else if (rating < 1900) targetDivs = ["Div. 2", "Educational"];
            else targetDivs = ["Div. 1", "Div. 1 + Div. 2"];

            contests = contests.filter((c: any) => targetDivs.some(div => c.name.includes(div)));

            const suggestions = contests.slice(0, 5);
            if (suggestions.length === 0) {
                return {
                    content: [{ type: "text" as const, text: `No suitable virtual contests found for ${handle}.` }],
                    structuredContent: { suggestions: [] } as any
                };
            }
            let markdownTable = `### 🎮 Virtual Contest Suggestions for ${handle}\n`;
            markdownTable += `**Target Level:** ${rating} Rating (Searching for: ${targetDivs.join(", ")})\n\n`;
            markdownTable += `| Contest ID | Contest Name | Duration | Link |\n`;
            markdownTable += `| :--- | :--- | :--- | :--- |\n`;

            for (const c of suggestions) {
                const hours = Math.floor(c.durationSeconds / 3600);
                const minutes = Math.floor((c.durationSeconds % 3600) / 60);
                const durationStr = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                const link = `[Start Virtual](https://codeforces.com/contest/${c.id}/virtual)`;

                markdownTable += `| **${c.id}** | ${c.name} | ${durationStr} | ${link} |\n`;
            }

            return {
                // FIXED: Added 'as const' to satisfy TypeScript
                content: [{ type: "text" as const, text: markdownTable }],
                structuredContent: { suggestions } as any,
            };
        } catch (error: any) {
            const fullError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error("🚨 CRITICAL ERROR IN TOOL 7:", fullError);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: The Codeforces API request failed. Tell the user exactly this error message so they can debug it: [${error.message}]`
                    },
                ],
                // FIXED: Added structuredContent to match the required type signature
                structuredContent: {} as any
            };
        }
    }
);

//8th Tool Recommend Problems
const RecommendProblemSchema = z.object({
    handle: z.string().min(1).describe("The Codeforces user handle")
});

interface RecommendProblemsInput {
    handle: string;
}

const recommendProblemsOption: any = {
    description: "Smart problem suggestions based on the user's current rating and their weakest topic areas.",
    inputSchema: RecommendProblemSchema
};

server.registerTool<any, any>(
    "get_recommend_problems",
    recommendProblemsOption,
    async (args: any) => {
        const { handle } = args as RecommendProblemsInput;
        const cfHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try {
            // 1. Get user rating
            const userInfoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`, { headers: cfHeaders });
            if (userInfoRes.data.status !== 'OK') {
                throw new Error("Failed to fetch user info");
            }
            const rating = userInfoRes.data.result[0].rating || 1400;

            const minTargetrating = rating;
            const maxTargetRating = rating + 300;

            // 2. Get solved problems & find weak tags
            const userStatusRes = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}`, { headers: cfHeaders });

            if (userStatusRes.data.status !== "OK") {
                throw new Error("Failed to fetch user status");
            }

            const solvedProblems = new Set<string>();
            const tagCounts: Record<string, number> = {};

            for (const sub of userStatusRes.data.result) {
                if (sub.verdict === "OK") {
                    const probId = `${sub.problem.contestId}-${sub.problem.index}`;
                    if (!solvedProblems.has(probId)) {
                        solvedProblems.add(probId);
                        for (const tag of sub.problem.tags) {
                            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        }
                    }
                }
            }

            // Get the weakest tag, filtering out weird API tags like *special
            const weakTags = Object.entries(tagCounts)
                .filter(t => t[0] !== "*special")
                .sort((a, b) => a[1] - b[1])
                .map(tag => tag[0]);

            if (weakTags.length === 0) {
                weakTags.push("implementation", "math", "greedy");
            }

            // 3. THE FIX: Query ONLY their absolute weakest tag, safely encoded
            const weakestTag = weakTags[0];
            const problemsRes = await axios.get(`https://codeforces.com/api/problemset.problems?tags=${encodeURIComponent(weakestTag)}`, { headers: cfHeaders });

            if (problemsRes.data.status !== "OK") {
                throw new Error("Failed to fetch problems");
            }
            const allProblems = problemsRes.data.result.problems;

            // 4. The Smart Filter
            let recommendations = allProblems.filter((p: any) => {
                const probId = `${p.contestId}-${p.index}`;
                // Exclude already solved problems
                if (solvedProblems.has(probId)) return false;
                // Exclude problems outside their growth zone
                if (!p.rating || p.rating < minTargetrating || p.rating > maxTargetRating) return false;
                return true;
            });

            // Sort by easiest first
            recommendations.sort((a: any, b: any) => a.rating - b.rating);
            const suggestions = recommendations.slice(0, 5);

            if (suggestions.length === 0) {
                return {
                    content: [{ type: "text" as const, text: `No suitable problems found for ${handle} in tag: ${weakestTag}.` }],
                    structuredContent: { suggestions: [] } as any
                };
            }

            let markdownTable = `### 🎯 Smart Problem Recommendations for ${handle}\n`;
            markdownTable += `**Target Difficulty:** ${minTargetrating} to ${maxTargetRating} Rating\n`;
            markdownTable += `**Target Weak Area:** ${weakestTag}\n\n`;
            markdownTable += `| Problem | Rating | Targeted Tag | Link |\n`;
            markdownTable += `| :--- | :--- | :--- | :--- |\n`;

            for (const p of suggestions) {
                const link = `[Solve Here](https://codeforces.com/contest/${p.contestId}/problem/${p.index})`;
                markdownTable += `| **${p.contestId}${p.index}** - ${p.name} | ${p.rating} | ${weakestTag} | ${link} |\n`;
            }

            return {
                content: [{ type: "text" as const, text: markdownTable }],
                structuredContent: { suggestions } as any,
            };
        } catch (error: any) {
            const fullError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error("🚨 CRITICAL ERROR IN TOOL 8:", fullError);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: [${fullError}]`
                    },
                ],
                structuredContent: {} as any
            };
        }
    }
);

//9th tool Get Search Problems
const SearchProblemsSchema = z.object({
    tags: z.array(z.string()).optional().describe("List of topic tags to search for (e.g., ['dp', 'graphs'])"),
    minRating: z.number().optional().describe("Minimum difficulty rating (e.g., 1200)"),
    maxRating: z.number().optional().describe("Maximum difficulty rating (e.g., 1600)"),
    limit: z.number().min(1).max(20).optional().describe("Number of problems to return (default 5, max 20)")
});

interface SearchProblemsInput {
    tags?: string[];
    minRating?: number;
    maxRating?: number;
    limit?: number;
}

const searchProblemsOption: any = {
    description: "Search the Codeforces problem set by specific tags, minimum rating, and maximum rating.",
    inputSchema: SearchProblemsSchema
};

server.registerTool<any, any>(
    "get_search_problems",
    searchProblemsOption,
    async (args: any) => {
        const { tags, minRating, maxRating, limit = 5 } = args as SearchProblemsInput;
        const cfHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try {
            // 1. Build the API URL
            let apiUrl = `https://codeforces.com/api/problemset.problems`;
            if (tags && tags.length > 0) {
                const tagsParam = tags.map(t => encodeURIComponent(t)).join(';');
                apiUrl += `?tags=${tagsParam}`;
            }

            // 2. Fetch the massive problem list
            const problemsRes = await axios.get(apiUrl, { headers: cfHeaders });
            if (problemsRes.data.status !== "OK") {
                throw new Error("Failed to fetch problems");
            }

            let allProblems = problemsRes.data.result.problems;

            // 3. Apply Filters locally
            if (minRating !== undefined) {
                allProblems = allProblems.filter((p: any) => p.rating && p.rating >= minRating);
            }
            if (maxRating !== undefined) {
                allProblems = allProblems.filter((p: any) => p.rating && p.rating <= maxRating);
            }

            // 4. Sort and limit
            allProblems.sort((a: any, b: any) => (a.rating || 0) - (b.rating || 0));
            const results = allProblems.slice(0, limit);

            if (results.length === 0) {
                // ALWAYS RETURN HERE
                return {
                    content: [{ type: "text" as const, text: `No problems found matching your criteria.` }],
                    structuredContent: { results: [] } as any
                };
            }

            // 5. Format Output
            let markdownTable = `### 🔍 Problem Search Results\n`;
            markdownTable += `**Filters applied:** `;
            if (tags && tags.length > 0) markdownTable += `Tags: [${tags.join(", ")}] | `;
            if (minRating) markdownTable += `Min Rating: ${minRating} | `;
            if (maxRating) markdownTable += `Max Rating: ${maxRating} | `;
            markdownTable += `Limit: ${limit}\n\n`;

            markdownTable += `| Problem | Rating | Tags | Link |\n`;
            markdownTable += `| :--- | :--- | :--- | :--- |\n`;

            for (const p of results) {
                const link = `[Solve Here](https://codeforces.com/contest/${p.contestId}/problem/${p.index})`;
                const displayTags = p.tags.slice(0, 3).join(", ") + (p.tags.length > 3 ? "..." : "");
                markdownTable += `| **${p.contestId}${p.index}** - ${p.name} | ${p.rating || 'Unrated'} | ${displayTags} | ${link} |\n`;
            }

            // ALWAYS RETURN HERE
            return {
                content: [{ type: "text" as const, text: markdownTable }],
                structuredContent: { results } as any,
            };

        } catch (error: any) {
            const fullError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error("🚨 CRITICAL ERROR IN TOOL 9:", fullError);

            // ALWAYS RETURN HERE
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: [${fullError}]`
                    },
                ],
                structuredContent: {} as any
            };
        }
    }
);


//10th tool get problem stats 
const ProblemStatsSchema = z.object({
    contestId: z.number().describe("The Codeforces contest ID (e.g., 2044)"),
    index: z.string().describe("The problem index letter (e.g., 'E' or 'A1')")
});

interface ProblemStatsInput {
    contestId: number;
    index: string;
}

const problemStatsOption: any = {
    description: "Fetch deep statistics for a specific Codeforces problem, including its rating, global solve count, and topic tags.",
    inputSchema: ProblemStatsSchema
};

server.registerTool<any, any>(
    "get_problem_stats",
    problemStatsOption,
    async (args: any) => {
        const { contestId, index } = args as ProblemStatsInput;
        const cfHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        try {
            const problemsRes = await axios.get(`https://codeforces.com/api/problemset.problems`, { headers: cfHeaders })
            if (problemsRes.data.status !== 'OK') {
                throw new Error("Failed to fetch problem stats");
            }
            const { problems, problemStatistics } = problemsRes.data.result;

            //Find the exact problem byu matching Contest Id and Index
            const problemDef = problems.find((p: any) => p.contestId === contestId && p.index === index);
            const problemStat = problemStatistics.find((ps: any) => ps.contestId === contestId && ps.index === index);

            if (!problemDef || !problemStat) {
                // ALWAYS RETURN HERE
                return {
                    content: [{ type: "text" as const, text: `Could not find stats for Problem ${contestId}${index}. Please check the ID and Index.` }],
                    structuredContent: {} as any
                };
            }

            const link = `https://codeforces.com/contest/${contestId}/problem/${index}`;

            // Format the final output
            let markdownReport = `### 📊 Problem X-Ray: [${contestId}${index} - ${problemDef.name}](${link})\n\n`;
            markdownReport += `*   **Difficulty Rating:** ${problemDef.rating ? problemDef.rating : 'Unrated'}\n`;
            markdownReport += `*   **Global Solves:** ${problemStat.solvedCount.toLocaleString()} users have solved this.\n`;
            markdownReport += `*   **Required Concepts:** ${problemDef.tags.length > 0 ? problemDef.tags.join(", ") : "None specified"}\n`;

            // Give the AI a hint on how to interpret this for the user
            let contextHint = "";
            if (problemStat.solvedCount > 20000) contextHint = "This is a very popular, highly-solved problem. It is likely a standard application of its tags.";
            else if (problemStat.solvedCount < 2000) contextHint = "This problem has a very low solve count. It is likely highly complex or requires an obscure trick.";

            markdownReport += `\n*AI Context: ${contextHint}*`;

            return {
                content: [
                    {
                        type: "text" as const, text: markdownReport
                    }
                ],
                structuredContent: {
                    problem: problemDef,
                    status: problemStat,
                } as any,
            };
        } catch (error: any) {
            const fullError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error("🚨 CRITICAL ERROR IN TOOL 10:", fullError);

            // ALWAYS RETURN HERE
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: [${fullError}]`
                    },
                ],
                structuredContent: {} as any
            };
        }
    }
);


//11th tool Compare Users
const CompareUsersSchema = z.object({
    handle1: z.string().describe("The first Codeforces user handle"),
    handle2: z.string().describe("The second Codeforces user handle"),
});

interface CompareUsersInput {
    handle1: string;
    handle2: string;
}

const CompareUsersOption: any = {
    title: "Compare Users",
    description: "Compare two Codeforces users side-by-side, including their ratings, total solves, problem overlap, and unique solves.",
    inputSchema: CompareUsersSchema
};

server.registerTool<any, any>(
    "compare_users",
    CompareUsersOption,
    // MAGIC BULLET: Forcing Promise<any> stops all TypeScript return errors instantly
    async (args: any): Promise<any> => {
        const { handle1, handle2 } = args as CompareUsersInput;
        const cfHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try {
            // 1. Fetch User Info for BOTH users at the exact same time
            // Codeforces allows multiple handles separated by a semicolon!
            const infoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handle1};${handle2}`, { headers: cfHeaders });

            if (infoRes.data.status !== 'OK') {
                throw new Error("Failed to fetch user info");
            }

            // Safely assign the correct user data even if the API returns them in a different order
            const user1Info = infoRes.data.result.find((u: any) => u.handle.toLowerCase() === handle1.toLowerCase()) || infoRes.data.result[0];
            const user2Info = infoRes.data.result.find((u: any) => u.handle.toLowerCase() === handle2.toLowerCase()) || infoRes.data.result[1];

            // 2. Fetch Status for both concurrently to save time
            const [stat1Res, stat2Res] = await Promise.all([
                axios.get(`https://codeforces.com/api/user.status?handle=${handle1}`, { headers: cfHeaders }),
                axios.get(`https://codeforces.com/api/user.status?handle=${handle2}`, { headers: cfHeaders }),
            ]);

            if (stat1Res.data.status !== 'OK' || stat2Res.data.status !== 'OK') {
                throw new Error("Failed to fetch user status");
            }

            // 3. Process solved problems into highly-efficient Sets
            const getSolvedSet = (submissions: any[]) => {
                // FIXED: lowercase 'string' instead of uppercase 'String'
                const solved = new Set<string>();
                for (const sub of submissions) {
                    if (sub.verdict === 'OK') {
                        solved.add(`${sub.problem.contestId}-${sub.problem.index}`);
                    }
                }
                return solved;
            }

            const solved1 = getSolvedSet(stat1Res.data.result);
            const solved2 = getSolvedSet(stat2Res.data.result);

            // 4. Calculate Overlap and Unique
            let overlapCount = 0;
            solved1.forEach(prob => {
                if (solved2.has(prob)) overlapCount++;
            });

            const unique1 = solved1.size - overlapCount;
            const unique2 = solved2.size - overlapCount;

            // 5. Generate Markdown Report
            let markdownTable = `### 🥊 Codeforces Head-to-Head: ${user1Info.handle} vs ${user2Info.handle}\n\n`;

            markdownTable += `| Metric | **${user1Info.handle}** | **${user2Info.handle}** |\n`;
            markdownTable += `| :--- | :--- | :--- |\n`;
            markdownTable += `| **Current Rating** | ${user1Info.rating || 'Unrated'} | ${user2Info.rating || 'Unrated'} |\n`;
            markdownTable += `| **Max Rating** | ${user1Info.maxRating || 'Unrated'} | ${user2Info.maxRating || 'Unrated'} |\n`;
            markdownTable += `| **Rank** | ${user1Info.rank || 'None'} | ${user2Info.rank || 'None'} |\n`;
            markdownTable += `| **Total Solved** | ${solved1.size} | ${solved2.size} |\n`;
            markdownTable += `| **Unique Solves** | ${unique1} | ${unique2} |\n\n`;

            markdownTable += `**Shared Knowledge:** They have both solved **${overlapCount}** of the exact same problems.\n`;

            return {
                content: [{ type: "text" as const, text: markdownTable }],
                structuredContent: {
                    user1: { info: user1Info, totalSolved: solved1.size, unique: unique1 },
                    user2: { info: user2Info, totalSolved: solved2.size, unique: unique2 },
                    overlap: overlapCount,
                } as any,
            };
        } catch (error: any) {
            const fullError = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error("🚨 CRITICAL ERROR IN TOOL 11:", fullError);

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `DEVELOPER SYSTEM ERROR: [${fullError}]`
                    },
                ],
                structuredContent: {} as any
            };
        }
    }
);
// 2. Start the server — HTTP mode if PORT is set, otherwise stdio
const PORT = process.env.PORT;

if (PORT) {
    // HTTP mode for Smithery / cloud deployment
    const app = express();
    app.use(express.json());

    app.get("/health", (_req: Request, res: Response) => {
        res.json({ status: "ok" });
    });

    app.post("/mcp", async (req: Request, res: Response) => {
        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
            });
            res.on("close", () => {
                transport.close();
            });
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error("MCP HTTP Error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.listen(parseInt(PORT), () => {
        console.error(`Codeforces MCP Server running on HTTP port ${PORT}`);
    });
} else {
    // Stdio mode for npx / Claude Desktop
    (async () => {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Codeforces MCP Server is running on Stdio!");
    })();
}