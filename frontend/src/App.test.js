import { render, screen } from "@testing-library/react";
import App from "./App";

test("shows loading then auth", async () => {
  render(<App />);
  expect(screen.getByText(/Loading/i)).toBeInTheDocument();
});
