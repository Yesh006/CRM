import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authState = vi.hoisted(() => ({ isAdmin: true, isSuperAdmin: false }));
const profileState = vi.hoisted(() => ({ profiles: [] as Array<{ id: string; name: string }> }));
const routerState = vi.hoisted(() => ({ push: vi.fn() }));

const profileApiMock = vi.hoisted(() => ({
  list: vi.fn().mockImplementation(() => Promise.resolve({ data: { data: profileState.profiles } })),
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerState }));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { firstName: 'Admin', lastName: 'User' },
    profile: null,
    logout: vi.fn(),
    isAdmin: authState.isAdmin,
    isSuperAdmin: authState.isSuperAdmin,
  }),
}));

vi.mock('@/lib/api', () => ({
  profileApi: profileApiMock,
}));

vi.mock('@/components/crm/search-dialog', () => ({
  SearchDialog: () => null,
}));

import { Header } from '../components/layout/header';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => undefined;
  window.HTMLElement.prototype.releasePointerCapture = () => undefined;
}

describe('Header admin home refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAdmin = true;
    authState.isSuperAdmin = false;
    routerState.push.mockClear();
    profileState.profiles = [{ id: 'profile-1', name: 'Standard User' }];
    profileApiMock.list.mockImplementation(() => Promise.resolve({ data: { data: profileState.profiles } }));
  });

  it('refreshes profiles on every Admin Home dropdown open', async () => {
    const { getByRole, findByText, getAllByRole, queryByRole, queryByText } = render(<Header onMenuClick={() => undefined} />);
    await waitFor(() => {
      expect(profileApiMock.list).toHaveBeenCalledWith({ limit: 100 });
    });

    fireEvent.keyDown(getByRole('button', { name: /Admin Home/i }), { key: 'Enter' });
    expect(await findByText('Standard User')).toBeTruthy();
    expect(getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Standard User']);

    fireEvent.click(getAllByRole('menuitem')[0]);
    expect(routerState.push).toHaveBeenCalledWith(
      '/profiles/standard-user?profileId=profile-1&profileLabel=Standard+User',
    );
    fireEvent.keyDown(getByRole('button', { name: /Admin Home/i }), { key: 'Escape' });
    await waitFor(() => expect(queryByRole('menuitem')).toBeNull());

    profileState.profiles = [
      { id: 'profile-1', name: 'Standard User' },
      { id: 'profile-2', name: 'Newly Added Profile' },
    ];
    fireEvent.keyDown(getByRole('button', { name: /Admin Home/i }), { key: 'Enter' });
    expect(await findByText('Newly Added Profile')).toBeTruthy();
    await waitFor(() => {
      expect(profileApiMock.list).toHaveBeenCalledTimes(3);
    });
    expect(getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Newly Added Profile',
      'Standard User',
    ]);
    expect(queryByRole('menuitem', { name: 'Admin Home' })).toBeNull();
    expect(queryByRole('menuitem', { name: /Dashboard|Executive Dashboard/i })).toBeNull();
  });

  it('hides the home selector from Super Admins', () => {
    authState.isAdmin = true;
    authState.isSuperAdmin = true;

    const { queryByRole } = render(<Header onMenuClick={() => undefined} />);
    expect(queryByRole('button', { name: /Admin Home/i })).toBeNull();
  });

  it('hides the home selector from users who are not Admin', () => {
    authState.isAdmin = false;
    authState.isSuperAdmin = false;

    const { queryByRole } = render(<Header onMenuClick={() => undefined} />);
    expect(queryByRole('button', { name: /Admin Home/i })).toBeNull();
  });

});
