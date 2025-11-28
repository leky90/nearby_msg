import { createBrowserRouter } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Home } from './pages/Home';
import { ChatPage } from './pages/ChatPage';

// Wrapper component to get groupId from URL params
function ChatPageWrapper() {
  const { groupId } = useParams<{ groupId: string }>();
  
  if (!groupId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn nhóm để xem chat</p>
      </div>
    );
  }
  
  return <ChatPage groupId={groupId} />;
}

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <Home />,
    },
    {
      path: '/chat/:groupId',
      element: <ChatPageWrapper />,
    },
  ]);
}

