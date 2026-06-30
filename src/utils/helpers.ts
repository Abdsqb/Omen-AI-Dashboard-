export function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function esc(s: string) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function md(text: string) {
  text = esc(text)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
  text = text.replace(
    /`([^`]+)`/g,
    '<code>$1</code>'
  )
  text = text.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
  text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  text = text.replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
  text = text.replace(/\n/g, '<br>')
  return text
}

export function priorityLabel(p: string | null) {
  if (!p || p === 'medium') return null
  return p
}
