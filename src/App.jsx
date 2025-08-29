import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";    // ← new path
import LivePage from "./pages/LivePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"     element={<HomePage />} />
        <Route path="/live" element={<LivePage />} />
      </Routes>
    </BrowserRouter>
  );
}
