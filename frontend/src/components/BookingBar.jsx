import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const QUICK_TIMES = [
  { label: "Now", getTime: () => new Date() },
  { label: "Morning", getTime: () => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; } },
  { label: "Afternoon", getTime: () => { const d = new Date(); d.setHours(14, 0, 0, 0); return d; } },
  { label: "Evening", getTime: () => { const d = new Date(); d.setHours(19, 0, 0, 0); return d; } }
];

const DURATION_OPTIONS = [2, 4, 6, 12, 24];

function normalizeDurationHours(value) {
  const n = Number(value);
  if (Number.isFinite(n) && DURATION_OPTIONS.includes(n)) return n;
  return 4;
}

const cn = (...classes) => classes.filter(Boolean).join(" ");
const pad2 = (n) => String(n).padStart(2, "0");

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDisplayDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date).replace(",", " •");
}

function toBookingParts(date) {
  return {
    rentalDate: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    startTime: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  };
}

function addHours(date, amount = 4) {
  const next = new Date(date);
  next.setHours(next.getHours() + amount);
  return next;
}

function fromBooking(booking) {
  if (!booking.rentalDate || !booking.startTime) return null;
  const parsed = new Date(`${booking.rentalDate}T${booking.startTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function TimeWheel({ items, selectedIndex, onSelect, label }) {
  const containerRef = useRef(null);
  const itemHeight = 40;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = selectedIndex * itemHeight;
    }
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const newIndex = Math.round(containerRef.current.scrollTop / itemHeight);
    if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < items.length) {
      onSelect(newIndex);
    }
  }, [items.length, onSelect, selectedIndex]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-indigo-100/70">{label}</span>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="hide-scrollbar relative h-[120px] w-16 overflow-y-auto"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div className="h-[40px]" />
        {items.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "h-[40px] w-full scroll-snap-align-center rounded-xl text-lg font-medium transition-all duration-200",
              index === selectedIndex
                ? "spring-pop scale-105 bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30"
                : "text-indigo-100/65 hover:text-white"
            )}
            style={{ scrollSnapAlign: "center" }}
          >
            {item}
          </button>
        ))}
        <div className="h-[40px]" />
      </div>
    </div>
  );
}

export default function BookingBar({ booking, setBooking, className = "" }) {
  const initial = useMemo(() => fromBooking(booking), [booking.rentalDate, booking.startTime]);
  const [durationHours, setDurationHours] = useState(() => normalizeDurationHours(booking.durationHours));
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initial);
  const [tempDate, setTempDate] = useState(initial);
  const [currentMonth, setCurrentMonth] = useState((initial || new Date()).getMonth());
  const [currentYear, setCurrentYear] = useState((initial || new Date()).getFullYear());
  const [slideDirection, setSlideDirection] = useState(null);
  const popoverRef = useRef(null);
  const inputRef = useRef(null);

  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
  const periods = ["AM", "PM"];

  const getTimeFromDate = useCallback((date) => {
    if (!date) return { hour: 11, minute: 0, period: 0 };
    const h = date.getHours();
    return {
      hour: (h % 12 === 0 ? 12 : h % 12) - 1,
      minute: date.getMinutes(),
      period: h >= 12 ? 1 : 0
    };
  }, []);

  const [timeState, setTimeState] = useState(getTimeFromDate(tempDate));

  useEffect(() => {
    const nextDuration = Number(booking.durationHours) > 0 ? Number(booking.durationHours) : 4;
    setDurationHours(nextDuration);
  }, [booking.durationHours]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const applyBooking = (dateValue, duration = durationHours) => {
    if (!dateValue) {
      setBooking((b) => ({ ...b, rentalDate: "", startTime: "", endTime: "", durationHours: duration }));
      return;
    }
    const { rentalDate, startTime } = toBookingParts(dateValue);
    const endDate = addHours(dateValue, duration);
    const computedEndTime = `${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`;
    setBooking((b) => ({ ...b, rentalDate, startTime, endTime: computedEndTime, durationHours: duration }));
  };

  const handlePrevMonth = () => {
    setSlideDirection("right");
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setTimeout(() => setSlideDirection(null), 280);
  };

  const handleNextMonth = () => {
    setSlideDirection("left");
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setTimeout(() => setSlideDirection(null), 280);
  };

  const updateTimeOnTempDate = (hourIdx, minuteIdx, periodIdx) => {
    setTimeState({ hour: hourIdx, minute: minuteIdx, period: periodIdx });
    if (!tempDate) return;
    const next = new Date(tempDate);
    let hour = hourIdx + 1;
    if (periodIdx === 1 && hour !== 12) hour += 12;
    if (periodIdx === 0 && hour === 12) hour = 0;
    next.setHours(hour, minuteIdx, 0, 0);
    setTempDate(next);
  };

  const handleDateClick = (day) => {
    const next = new Date(currentYear, currentMonth, day);
    if (tempDate) {
      next.setHours(tempDate.getHours(), tempDate.getMinutes(), 0, 0);
    } else {
      let hour = timeState.hour + 1;
      if (timeState.period === 1 && hour !== 12) hour += 12;
      if (timeState.period === 0 && hour === 12) hour = 0;
      next.setHours(hour, timeState.minute, 0, 0);
    }
    setTempDate(next);
  };

  const handleQuickTime = (getTime) => {
    const picked = getTime();
    const next = tempDate ? new Date(tempDate) : new Date();
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    setTempDate(next);
    setTimeState(getTimeFromDate(next));
  };

  const handleConfirm = () => {
    setSelectedDate(tempDate);
    applyBooking(tempDate, durationHours);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempDate(selectedDate);
    setTimeState(getTimeFromDate(selectedDate));
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempDate(null);
    setSelectedDate(null);
    setTimeState({ hour: 11, minute: 0, period: 0 });
    applyBooking(null, durationHours);
  };

  const handleOpen = () => {
    if (!isOpen) {
      const current = selectedDate;
      setTempDate(current);
      setTimeState(getTimeFromDate(current));
      if (current) {
        setCurrentMonth(current.getMonth());
        setCurrentYear(current.getFullYear());
      }
    }
    setIsOpen((v) => !v);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSameDay = (a, b) => !!a && a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const isToday = (day) => isSameDay(today, new Date(currentYear, currentMonth, day));
  const isSelected = (day) => isSameDay(tempDate, new Date(currentYear, currentMonth, day));
  const startLabel = booking.startTime || "--:--";
  const endLabel = booking.endTime || "--:--";

  return (
    <div className={cn("relative", isOpen && "z-[260]", className)}>
      <button
        ref={inputRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          "glass-card group flex w-full items-center gap-3 rounded-full px-5 py-4 transition-all duration-300 hover:border-indigo-400/40",
          isOpen && "glow-effect border-indigo-400/50 ring-2 ring-indigo-500/50"
        )}
      >
        <CalendarIcon className="h-5 w-5 text-indigo-300" />
        <span className={cn("flex-1 text-left text-base", selectedDate ? "text-white" : "text-indigo-100/70")}>
          {selectedDate ? formatDisplayDate(selectedDate) : "Select date & time"}
        </span>
        <Clock className="h-5 w-5 text-purple-300" />
      </button>

      <div className="booking-summary mt-2">
        <span><strong>Start:</strong> {startLabel}</span>
        <span><strong>End:</strong> {endLabel}</span>
        <span><strong>Duration:</strong> {durationHours}h</span>
      </div>

      {isOpen && (
        <div ref={popoverRef} className="scale-in absolute left-0 top-full z-[280] mt-3">
          <div className="aurora-border glow-effect rounded-3xl p-[2px]">
            <div className="glass-card min-w-[340px] rounded-3xl p-5 sm:min-w-[640px]">
              <div className="grid gap-5 sm:grid-cols-[1.35fr_1fr]">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <button type="button" onClick={handlePrevMonth} className="glass-card h-10 w-10 rounded-full transition hover:bg-white/10">
                      <ChevronLeft className="mx-auto h-5 w-5 text-white" />
                    </button>
                    <h2 className="text-lg font-semibold text-white">{MONTHS[currentMonth]} {currentYear}</h2>
                    <button type="button" onClick={handleNextMonth} className="glass-card h-10 w-10 rounded-full transition hover:bg-white/10">
                      <ChevronRight className="mx-auto h-5 w-5 text-white" />
                    </button>
                  </div>

                  <div className={cn("grid grid-cols-7 gap-1", slideDirection === "left" && "slide-left", slideDirection === "right" && "slide-right")}>
                    {WEEKDAYS.map((day) => (
                      <div key={day} className="flex h-8 items-center justify-center text-xs uppercase tracking-wider text-indigo-50/85">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="h-10" />)}
                    {days.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDateClick(day)}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-200 hover:scale-110",
                          isSelected(day)
                            ? "spring-pop bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40"
                            : isToday(day)
                              ? "text-indigo-100 ring-2 ring-indigo-300/65 hover:bg-indigo-500/25"
                              : "text-indigo-50/95 hover:bg-white/12"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-card rounded-2xl border border-white/5 p-4">
                  <h3 className="mb-4 text-center text-sm font-semibold text-indigo-50">Choose time</h3>
                  <div className="mb-4 flex items-center justify-center gap-4">
                    <TimeWheel items={hours} selectedIndex={timeState.hour} onSelect={(i) => updateTimeOnTempDate(i, timeState.minute, timeState.period)} label="Hour" />
                    <span className="mt-6 text-2xl font-light text-indigo-50/90">:</span>
                    <TimeWheel items={minutes} selectedIndex={timeState.minute} onSelect={(i) => updateTimeOnTempDate(timeState.hour, i, timeState.period)} label="Min" />
                    <TimeWheel items={periods} selectedIndex={timeState.period} onSelect={(i) => updateTimeOnTempDate(timeState.hour, timeState.minute, i)} label="Period" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_TIMES.map((qt) => (
                      <button
                        key={qt.label}
                        type="button"
                        onClick={() => handleQuickTime(qt.getTime)}
                        className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-50/90 transition hover:border-indigo-300/45 hover:bg-indigo-500/25 hover:text-white"
                      >
                        {qt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-50/85">Duration</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {DURATION_OPTIONS.map((hrs) => (
                        <button
                          key={hrs}
                          type="button"
                          onClick={() => {
                            setDurationHours(hrs);
                            if (tempDate) applyBooking(tempDate, hrs);
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                            durationHours === hrs
                              ? "border-indigo-300/70 bg-indigo-500/35 text-white"
                              : "border-white/15 bg-white/10 text-indigo-50/85 hover:border-indigo-300/45 hover:bg-indigo-500/25"
                          )}
                        >
                          {hrs} hours
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button type="button" onClick={handleClear} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-indigo-50/90 transition hover:text-rose-300">
                  <X className="h-4 w-4" />
                  Clear
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleCancel} className="glass-card rounded-xl px-5 py-2.5 text-sm font-medium transition hover:bg-white/10">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:scale-105 hover:from-indigo-400 hover:to-purple-500"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
