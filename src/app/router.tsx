import { useEffect, useState } from 'react';

export type Route =
  | 'dashboard'
  | 'senders'
  | 'newsletters'
  | 'storage'
  | 'analytics'
  | 'accounts'
  | 'settings';

const VALID_ROUTES: Route[] = [
  'dashboard',
  'senders',
  'newsletters',
  'storage',
  'analytics',
  'accounts',
  'settings',
];

function parseRoute(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '') as Route;
  return VALID_ROUTES.includes(cleaned) ? cleaned : 'dashboard';
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: Route) => {
    window.location.hash = `/${next}`;
  };

  return [route, navigate];
}
