import React from "react";

export default function App() {
  return (
    <div style={{ padding: 40 }}>
      <h1>YOHOME Clinic System</h1>

      <button
        onClick={() => alert("系统正常运行")}
        style={{
          padding: "10px 20px",
          marginTop: 20,
          cursor: "pointer",
        }}
      >
        测试按钮
      </button>
    </div>
  );
}
