import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { queryClient } from '../store/queryClient';
import '../styles/globals.css';

import { sanitizeStoredData } from '../lib/db/sanitize';

void sanitizeStoredData().then(({ fixedMessagesCount }) => {
  if (fixedMessagesCount > 0) {
    void queryClient.invalidateQueries();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
