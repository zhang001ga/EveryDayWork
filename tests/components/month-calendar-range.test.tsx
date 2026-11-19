import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthCalendar } from "../../src/components/MonthCalendar";

function renderCalendar(month: string, minMonth: string, onMonthChange = vi.fn()) {
  render(<MonthCalendar month={month} minMonth={minMonth} selectedDate={`${month}-15`} onMonthChange={onMonthChange} onSelectDate={() => undefined} renderDay={() => null} />);
  return onMonthChange;
}

describe("month calendar range limit", () => {
  it("still pages back while the previous month is inside the allowed range", async () => {
    const user = userEvent.setup();
    const onMonthChange = renderCalendar("2026-11", "2025-12");
    await user.click(screen.getByRole("button", { name: "上个月" }));
    expect(onMonthChange).toHaveBeenCalledWith("2026-10");
  });

  it("disables paging before the earliest allowed month", async () => {
    const user = userEvent.setup();
    const onMonthChange = renderCalendar("2025-12", "2025-12");
    const previous = screen.getByRole("button", { name: "上个月" });
    expect(previous).toBeDisabled();
    await user.click(previous);
    expect(onMonthChange).not.toHaveBeenCalled();
  });
});
