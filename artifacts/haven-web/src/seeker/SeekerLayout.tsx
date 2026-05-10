import { Outlet } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";

export default function SeekerLayout() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}
