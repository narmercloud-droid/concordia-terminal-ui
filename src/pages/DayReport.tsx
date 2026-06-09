import { useEffect, useState } from 'react'
import { dailyReportApi, type DailyReport } from '../api/dailyReport.js'
import { printDayReport } from '../hooks/useDayClose.js'
import { Loader } from '../components/Loader.js'
import { ErrorMessage } from '../components/ErrorMessage.js'
import { Toast } from '../components/Toast.js'
import { formatCurrency } from '../utils/format.js'
import '../App.css'

const DayReport = () => {
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setReport(await dailyReportApi.getToday())
    } catch (err) {
      setError('Tagesbericht konnte nicht geladen werden.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const result = await printDayReport()
      setToast(result.message)
      if (result.ok) await load()
    } catch (err) {
      setError('Druck fehlgeschlagen.')
      console.error(err)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h1>Tagesabschluss</h1>
            <p>Zum Restaurant-Schließen: Bericht prüfen und manuell drucken.</p>
          </div>
          <button className="button primary" type="button" onClick={handlePrint} disabled={printing || loading}>
            {printing ? 'Druckt…' : 'Bericht drucken'}
          </button>
        </div>

        {toast && <Toast visible message={toast} onClose={() => setToast('')} />}
        {loading ? (
          <Loader />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : report ? (
          <>
            <p className="report-date">{report.dateLabel}</p>
            <div className="report-grid">
              <div className="report-stat">
                <span>Bestellungen</span>
                <strong>{report.orderCount}</strong>
              </div>
              <div className="report-stat">
                <span>Umsatz brutto</span>
                <strong>{formatCurrency(report.grossRevenue)}</strong>
              </div>
              <div className="report-stat">
                <span>Umsatz netto</span>
                <strong>{formatCurrency(report.netRevenue)}</strong>
              </div>
              <div className="report-stat">
                <span>Storniert</span>
                <strong>{report.cancelledCount}</strong>
              </div>
              <div className="report-stat">
                <span>Lieferung</span>
                <strong>
                  {report.delivery.count} · {formatCurrency(report.delivery.revenue)}
                </strong>
              </div>
              <div className="report-stat">
                <span>Abholung</span>
                <strong>
                  {report.pickup.count} · {formatCurrency(report.pickup.revenue)}
                </strong>
              </div>
            </div>

            <section className="list-section">
              <h2>Zahlungsarten</h2>
              {report.paymentBreakdown.length === 0 ? (
                <p className="empty-state">Heute noch keine abgeschlossenen Bestellungen.</p>
              ) : (
                <ul className="report-list">
                  {report.paymentBreakdown.map((row) => (
                    <li key={row.method}>
                      {row.method}: {row.count}× {formatCurrency(row.total)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="privacy-note">Ältere Tage werden aus Datenschutzgründen nicht angezeigt.</p>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default DayReport
