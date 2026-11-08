// Shapes returned to the mobile app. Field names match the old API where the app depends on
// them. Password and PIN hashes are never serialised (the old API returned whole user documents).
const num = (value) => (value === null || value === undefined ? value : Number(value))

function toLegacyTransaction (tx) {
  if (!tx) return null
  return {
    id: tx.id,
    identifierId: tx.reference,
    reference: tx.reference,
    fundingType: tx.fundingType,
    status: tx.status,
    paymentConfirmation: tx.paymentConfirmation,
    registrationDateTime: tx.registeredAt,
    completedAt: tx.completedAt,
    amount: num(tx.amount),
    totalAmount: num(tx.totalAmount),
    bonusBalance: num(tx.walletAmount), // wallet portion (old field name)
    walletAmount: num(tx.walletAmount),
    betId: tx.betId,
    momoNumber: tx.momoNumber,
    network: tx.network,
    service: tx.service,
    withdrawalCode: tx.withdrawalCode,
    customErrorCode: tx.customErrorCode,
    authenticatedDeposit: tx.authenticatedDeposit,
    recipientid: tx.counterpartyId,
    recipientName: tx.recipientName,
    recipientTag: tx.recipientTag,
    senderName: tx.senderName
  }
}

function toUserDto (user, { transactions } = {}) {
  if (!user) return null
  const history = transactions ? transactions.map(toLegacyTransaction) : undefined
  return {
    _id: user.id,
    id: user.id,
    fullname: user.fullname,
    email: user.email,
    tag: user.tag,
    betId: user.betId,
    number: user.phoneNumber,
    phoneNumber: user.phoneNumber,
    image: user.image,
    colorScheme: user.colorScheme,
    role: user.role,
    isActivated: user.isActivated,
    pinState: user.pinState,
    deleteRequestState: user.deleteRequestState,
    bonusBalance: num(user.bonusBalance),
    restrictedBonusBalance: num(user.restrictedBonusBalance),
    successfulDepositCount: user.successfulDepositCount,
    registrationDateTime: user.registeredAt,
    ...(history ? { transactionHistory: history, bonus: history.filter((t) => t.bonusBalance > 0 || t.fundingType === 'bonus') } : {})
  }
}

/** The small public profile other users may see. */
const toPublicProfile = (user) => ({ _id: user.id, id: user.id, fullname: user.fullname, tag: user.tag, image: user.image })

module.exports = { toLegacyTransaction, toUserDto, toPublicProfile }
