"use client";
import { useState } from "react";

export default function PuterPage() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call Puter API
      const res = await fetch("https://api.puter.com/v1/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5", // you can change to other supported models
          prompt: prompt
        })
      });

      const data = await res.json();
      setResponse(data.output || "No response");
    } catch (err: any) {
      setResponse("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Puter AI Demo</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type something..."
          style={{ width: "300px", padding: "0.5rem" }}
        />
        <button type="submit" style={{ marginLeft: "1rem" }}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
      <div style={{ marginTop: "2rem" }}>
        <strong>Response:</strong>
        <p>{response}</p>
      </div>
    </div>
  );
}
