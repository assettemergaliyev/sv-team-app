import { test, expect } from '@playwright/test';

test('login, duration mask, saving and publication survive page reload (mock Auth/API)', async ({ page }) => {
  const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const club = id(1), user = id(2), athlete = id(3), definition = id(4), event = id(5), session = id(6), participant = id(7), entry = id(8);
  const tables: Record<string, Record<string, unknown>[]> = {
    club_users: [{ club_id: club, user_id: user, role: 'ADMIN', access_status: 'ACTIVE' }],
    clubs: [{ id: club, name: 'SV Team — тест интерфейса', timezone: 'Asia/Almaty' }],
    athletes: [{ id: athlete, club_id: club, first_name: 'Тестовый', last_name: 'Спортсмен', sport_status: 'ACTIVE' }],
    test_definitions: [{ id: definition, club_id: club, discipline: 'SWIMMING', distance_m: 50, stroke_code: 'FREESTYLE' }],
    sport_groups: [],
    test_events: [{ id: event, club_id: club, definition_id: definition, title: 'Контрольный старт — пример', lifecycle: 'OPEN', revision: 1 }],
    test_sessions: [{ id: session, club_id: club, event_id: event, scheduled_on: '2026-10-02', scheduled_at: '2026-10-02T02:00:00Z', label: 'Плавание — утро', status: 'DRAFT', revision: 1 }],
    event_participants: [{ id: participant, club_id: club, event_id: event, athlete_id: athlete }],
    session_participants: [{ id: entry, club_id: club, event_id: event, session_id: session, event_participant_id: participant }],
    attempts: [], event_leaderboard: [],
  };
  const mockUser = { id: user, email: 'test-admin@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'fake-test-signature'].join('.');
  let saves = 0;
  await page.route('**/auth/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path.endsWith('/user') ? mockUser : { access_token: token, token_type: 'bearer', refresh_token: 'test-refresh', expires_in: 3600, user: mockUser }) });
  });
  await page.route('**/rest/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/rpc/sv_command')) {
      const body = route.request().postDataJSON();
      if (body.p_action === 'SAVE_ATTEMPT') {
        saves++;
        tables.attempts.push({ id: id(9), club_id: club, session_participant_id: entry, attempt_no: 1, revision: 1, status: body.p_payload.status, time_cs: body.p_payload.time_cs });
      } else if (body.p_action === 'PUBLISH_SESSION') {
        tables.test_sessions[0].status = 'PUBLISHED'; tables.test_sessions[0].revision = 2;
        tables.event_leaderboard = [{ club_id: club, event_id: event, athlete_id: athlete, best_time_cs: 3250, place: 1 }];
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: id(9), revision: 1 }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tables[path.split('/').pop()!] ?? []) });
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Результаты твоей команды' })).toBeVisible();
  await page.getByLabel('Почта', { exact: true }).fill('test-admin@example.com');
  await page.getByLabel('Пароль', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SV Team — тест интерфейса' })).toBeVisible();
  await page.getByLabel('Выбрать старт').selectOption(event);
  const time = page.locator('.attempt').getByLabel('Время', { exact: true });
  await time.fill('006900');
  await expect(time).toHaveValue('00:69.00');
  await page.getByRole('button', { name: 'Сохранить попытку' }).click();
  await expect(page.getByRole('alert')).toContainText('Минуты и секунды');
  expect(saves).toBe(0);
  await time.fill('003250');
  await expect(time).toHaveValue('00:32.50');
  const checkbox = page.getByLabel('Добавить часы');
  const bounds = await checkbox.boundingBox();
  expect(bounds?.width).toBe(16); expect(bounds?.height).toBe(16);
  await page.getByRole('button', { name: 'Сохранить попытку' }).click();
  await expect(page.getByText('Попытка 1:', { exact: false })).toBeVisible();
  expect(saves).toBe(1);
  await page.getByRole('button', { name: 'Опубликовать сессию' }).click();
  await expect(page.getByRole('cell', { name: '00:32.50' })).toBeVisible();
  await page.reload();
  await page.getByLabel('Выбрать старт').selectOption(event);
  await expect(page.getByRole('cell', { name: '00:32.50' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-portal.png', fullPage: true });
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
});
