const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const layout = (title, bodyHtml) => `<!doctype html>
<html><body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
    <div style="background:#111827;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">LamedCash</div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb">
      If you did not expect this email, you can ignore it.
    </div>
  </div>
</body></html>`

const p = (text) => `<p style="line-height:1.55;margin:0 0 12px">${text}</p>`
const code = (value) =>
  `<p style="font-size:30px;letter-spacing:6px;font-weight:bold;background:#f3f4f6;border-radius:8px;padding:14px;text-align:center;margin:16px 0">${escapeHtml(value)}</p>`
const amountText = (amount) => `${escapeHtml(Number(amount).toLocaleString('en-US'))} F`

// One entry per email type used by the application.
const templates = {
  PASSWORD_RESET_CODE: ({ fullname, code: c }) => ({
    subject: 'Your password reset code',
    html: layout('Reset your password', p(`Hello ${escapeHtml(fullname)},`) + p('Use this code to reset your password. It expires in 15 minutes and works once.') + code(c))
  }),
  PIN_RESET_CODE: ({ fullname, code: c }) => ({
    subject: 'Your PIN reset code',
    html: layout('Reset your PIN', p(`Hello ${escapeHtml(fullname)},`) + p('Use this code to reset your PIN. It expires in 15 minutes and works once.') + code(c))
  }),
  DEPOSIT_SUCCESSFUL: ({ fullname, amount, betId }) => ({
    subject: 'Deposit successful',
    html: layout('Deposit successful', p(`Hello ${escapeHtml(fullname)},`) + p(`Your deposit of <b>${amountText(amount)}</b> to betting account <b>${escapeHtml(betId)}</b> was successful.`))
  }),
  DEPOSIT_PENDING: ({ fullname, amount, betId }) => ({
    subject: 'Deposit pending',
    html: layout('Deposit pending', p(`Hello ${escapeHtml(fullname)},`) + p(`Your deposit of <b>${amountText(amount)}</b> to betting account <b>${escapeHtml(betId)}</b> is being processed. We will confirm as soon as it completes.`))
  }),
  DEPOSIT_FAILED: ({ fullname, amount, betId }) => ({
    subject: 'Deposit failed',
    html: layout('Deposit failed', p(`Hello ${escapeHtml(fullname)},`) + p(`Your deposit of <b>${amountText(amount)}</b> to betting account <b>${escapeHtml(betId)}</b> could not be completed. Any wallet funds used were returned.`))
  }),
  WITHDRAWAL_PENDING: ({ fullname, amount, betId }) => ({
    subject: 'Withdrawal request received',
    html: layout('Withdrawal pending', p(`Hello ${escapeHtml(fullname)},`) + p(`We received your withdrawal request of <b>${amountText(amount)}</b> for account <b>${escapeHtml(betId)}</b>. It is being processed.`))
  }),
  WITHDRAWAL_FAILED: ({ fullname, amount, betId }) => ({
    subject: 'Withdrawal failed',
    html: layout('Withdrawal failed', p(`Hello ${escapeHtml(fullname)},`) + p(`Your withdrawal of <b>${amountText(amount)}</b> for account <b>${escapeHtml(betId)}</b> could not be completed. Any wallet funds used were returned.`))
  }),
  TRANSFER_SENT: ({ fullname, amount, recipientName }) => ({
    subject: 'Money sent',
    html: layout('Money sent', p(`Hello ${escapeHtml(fullname)},`) + p(`You sent <b>${amountText(amount)}</b> to <b>${escapeHtml(recipientName)}</b> from your wallet.`))
  }),
  TRANSFER_RECEIVED: ({ fullname, amount, senderName }) => ({
    subject: 'Money received',
    html: layout('Money received', p(`Hello ${escapeHtml(fullname)},`) + p(`You received <b>${amountText(amount)}</b> from <b>${escapeHtml(senderName)}</b> in your wallet.`))
  }),
  REFERRAL_BONUS: ({ fullname, amount }) => ({
    subject: 'You earned a referral bonus',
    html: layout('Referral bonus', p(`Hello ${escapeHtml(fullname)},`) + p(`A person you referred made a deposit. <b>${amountText(amount)}</b> was added to your wallet.`))
  }),
  ACCOUNT_DELETION_REQUESTED: ({ fullname }) => ({
    subject: 'Account deletion request received',
    html: layout('Account deletion', p(`Hello ${escapeHtml(fullname)},`) + p('We received your request to delete your account. Your account has been deactivated while we process it.'))
  })
}

module.exports = { templates, escapeHtml }
