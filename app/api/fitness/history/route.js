export const dynamic = 'force-dynamic'
function retired() {
  return Response.json(
    {
      error:
        'This feature has been retired. Historical data remains available in your account export.',
      code: 'FEATURE_RETIRED',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  )
}
export { retired as GET, retired as POST, retired as PATCH, retired as DELETE }
