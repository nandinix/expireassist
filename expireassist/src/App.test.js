import { render, screen } from '@testing-library/react';
import App from './App';

test('renders header', () => {
  render(<App />);
  const header = screen.getByRole('heading', { name: /ExpireAssist/i });
  expect(header).toBeInTheDocument();
});
