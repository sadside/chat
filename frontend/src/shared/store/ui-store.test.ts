import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './ui-store';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: false });
  });

  it('starts with sidebar closed', () => {
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('openSidebar sets sidebarOpen true', () => {
    useUiStore.getState().openSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('closeSidebar sets sidebarOpen false', () => {
    useUiStore.getState().openSidebar();
    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });

  it('toggleSidebar flips sidebarOpen', () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
  });
});
