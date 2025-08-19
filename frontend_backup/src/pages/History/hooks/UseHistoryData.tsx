// src/pages/History/hooks/UseHistoryData.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { HistoryAPI, HistoryUtils, HistoryState, HistoryFilters } from '../../../services/HistoryTypes';

const initialState: HistoryState = {
  isLoading: false,
  error: null,
  showFilters: false,
  showDatePicker: false,
  selectedDate: null,
  filters: { date: null, sensorType: null, status: null },
  events: [],
  totalPages: 1,
  currentPage: 1,
};

export default function useHistoryData() {
  const [historyState, setHistoryState] = useState<HistoryState>(initialState);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const reqIdRef = useRef(0);
  const latestFiltersRef = useRef(historyState.filters);

  const resetFilters = useCallback(() => {
    latestFiltersRef.current = { date: null, sensorType: null, status: null };  // ✅ ref 초기화
    setHistoryState({
      isLoading: false,
      error: null,
      showFilters: false,        // ✅ 필터 UI도 닫기
      showDatePicker: false,
      selectedDate: null,
      filters: { date: null, sensorType: null, status: null },
      events: [],
      totalPages: 1,
      currentPage: 1,
    });

    // ✅ 드롭다운도 초기화
    setActiveDropdown(null);
  }, []);

    const updateFilter = useCallback((key: keyof HistoryFilters, value: string | null) => {
  setHistoryState((prev) => {
    const next = { ...prev.filters, [key]: value };
    latestFiltersRef.current = next;   // 최신 필터 ref도 함께 갱신
    return { ...prev, filters: next };
  });
}, []);

  const handleDateSelect = useCallback((date: Date) => {
    setHistoryState((prev) => {
      const next = { ...prev.filters, date: HistoryUtils.formatDateToString(date) };
      latestFiltersRef.current = next;      // ✅ ref 최신화
      return { ...prev, selectedDate: date, filters: next };
    });
  }, []);

  const applyFilters = useCallback((page: number = 1) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const myReqId = ++reqIdRef.current;

      setHistoryState(prev => ({ ...prev, isLoading: true, error: null, currentPage: page }));

      try {
        const { events, totalPages } = await HistoryAPI.fetchEvents(
          latestFiltersRef.current,   // ✅ 최신 필터 객체
          page
        );

        if (myReqId === reqIdRef.current) {
          setHistoryState(prev => ({
            ...prev,
            events,
            totalPages,
            isLoading: false,
          }));
        }
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('429')) {
          if (retryRef.current) window.clearTimeout(retryRef.current);
          retryRef.current = window.setTimeout(() => {
            inFlightRef.current = false;
            applyFilters(page);
          }, 1500);
        } else {
          setHistoryState(prev => ({
            ...prev,
            isLoading: false,
            error: msg || '데이터 로드 실패',
            events: [],
            totalPages: 1,
          }));
        }
      } finally {
        inFlightRef.current = false;
      }
    }, 400);
  }, []); // ✅ 의존성 배열 비움

  const changePage = useCallback((page: number) => {
    applyFilters(page); // ✅ 동일 경로로 통일(디바운스/백오프 적용)
  }, [applyFilters]);

  const toggleFilters = useCallback(() => {
    setHistoryState((prev) => ({ ...prev, showFilters: !prev.showFilters }));
  }, []);

  const loadHistoryData = useCallback((page?: number) => {
    applyFilters(page ?? 1);
  }, [applyFilters]);
  const updateHistoryState = useCallback((patch: Partial<HistoryState>) => {
    setHistoryState((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    historyState,
    activeDropdown,
    setActiveDropdown,
    updateFilter,
    resetFilters,
    handleDateSelect,
    applyFilters,
    changePage,
    toggleFilters,

    // HistoryScreen에서 사용
    loadHistoryData,
    updateHistoryState,
  };
}