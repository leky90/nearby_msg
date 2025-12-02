import { createBrowserRouter, Navigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { ChatPage } from "./pages/ChatPage";
import { ErrorPage } from "./pages/ErrorPage";

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: "/",
      element: <Home />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/chat/:groupId",
      element: <ChatPage />,
      errorElement: <ErrorPage />,
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ]);
}
