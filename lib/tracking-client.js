/** Keep server errors actionable and translated without exposing backend details. */
export function trackingErrorMessage(error, t) {
  const specific = {
    'A started attempt keeps its original period. Restart instead.': [
      'Период уже начался. Создайте новую попытку, чтобы изменить даты.',
      'This attempt has started. Restart to change its dates.',
    ],
    'The challenge already has a newer attempt. Refresh to see it.': [
      'Новая попытка уже создана. Обновите страницу.',
      'A newer attempt already exists. Refresh this page.',
    ],
    'Restore this challenge before editing its history.': [
      'Сначала верните челлендж из архива.',
      'Restore this challenge before editing its history.',
    ],
    'Choose today or a past date within this attempt.': [
      'Выберите сегодняшний или прошедший день в периоде попытки.',
      'Choose today or a past day within this attempt.',
    ],
    'Choose today or a past date since this habit was created.': [
      'Можно изменить только прошедшие дни с момента создания привычки и сегодняшний день.',
      'Choose today or a past day since this habit was created.',
    ],
    'This habit is not scheduled for that weekday.': [
      'В этот день привычка не запланирована.',
      'This habit is not scheduled for this weekday.',
    ],
    'The list changed. Refresh before reordering.': [
      'Список изменился. Обновите страницу и повторите.',
      'The list changed. Refresh and try again.',
    ],
  }
  if (specific[error.message]) return t(...specific[error.message])
  if (error.status === 401)
    return t('Сессия истекла. Войдите снова.', 'Your session expired. Sign in again.')
  if (error.status === 404)
    return t('Запись больше не доступна.', 'This item is no longer available.')
  if (error.status === 400)
    return t(
      'Проверьте название, даты и расписание.',
      'Please check the name, dates, and schedule.',
    )
  return t(
    'Не удалось выполнить действие. Проверьте подключение и повторите.',
    'Unable to complete this action. Check your connection and try again.',
  )
}
