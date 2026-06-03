import { useState, useEffect } from 'react';

function usePersistentState<T>(key: string, initialState: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = sessionStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : initialState;
    } catch (error) {
      console.error(`Error reading sessionStorage key “${key}”:`, error);
      return initialState;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error setting sessionStorage key “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

export default usePersistentState;