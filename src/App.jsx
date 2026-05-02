import React, { useState, useEffect, useMemo } from "react";

export default function App() {
  const [name, setName] = useState("");

  return (
    <div style={{ padding: 20 }}>
      <h1>YOHOME Clinic System</h1>

      <input
        placeholder="Client name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <p>Current: {name}</p>
    </div>
  );
}
