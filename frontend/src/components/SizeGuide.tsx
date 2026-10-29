export const sizeTables: Record<string, { title: string; headers: string[]; rows: string[][] }> = {
  skate: {
    title: 'Размеры коньков',
    headers: ['EU', 'Длина стопы (см)'],
    rows: [['36', '23.0'], ['37', '23.5'], ['38', '24.0'], ['39', '24.5'], ['40', '25.5'], ['41', '26.0'], ['42', '26.5'], ['43', '27.0'], ['44', '28.0'], ['45', '28.5'], ['46', '29.0']],
  },
  ski_boot: {
    title: 'Размеры лыжных ботинок',
    headers: ['EU', 'Длина стопы (см)'],
    rows: [['36', '23.0'], ['37', '23.5'], ['38', '24.0'], ['39', '24.5'], ['40', '25.5'], ['41', '26.0'], ['42', '26.5'], ['43', '27.0'], ['44', '28.0'], ['45', '28.5'], ['46', '29.0']],
  },
  snowboard_boot: {
    title: 'Размеры ботинок для сноуборда',
    headers: ['EU', 'Длина стопы (см)'],
    rows: [['36', '23.0'], ['37', '23.5'], ['38', '24.0'], ['39', '24.5'], ['40', '25.5'], ['41', '26.0'], ['42', '26.5'], ['43', '27.0'], ['44', '28.0'], ['45', '28.5'], ['46', '29.0']],
  },
  ski: {
    title: 'Размеры горных лыж',
    headers: ['Размер', 'Рост (см)'],
    rows: [['S', 'до 160'], ['M', '160–170'], ['L', '170–180'], ['XL', '180+']],
  },
  snowboard: {
    title: 'Размеры сноубордов',
    headers: ['Размер', 'Рост (см)'],
    rows: [['S', 'до 160'], ['M', '160–170'], ['L', '170–180'], ['XL', '180+']],
  },
  helmet: {
    title: 'Размеры шлемов',
    headers: ['Размер', 'Обхват головы (см)'],
    rows: [['S', '51–56'], ['M', '55–57'], ['L', '56–61']],
  },
  gloves: {
    title: 'Перчатки',
    headers: ['Размер', 'Обхват ладони (см)'],
    rows: [['S', '20'], ['M', '23'], ['L', '25'], ['XL', '28']],
  },
  jacket_m: {
    title: 'Куртки (Мужские)',
    headers: ['Размер', 'Российский', 'Обхват груди (см)'],
    rows: [['S', '44-46', '86-91'], ['M', '48-50', '96-101'], ['L', '52', '106-111'], ['XL', '54', '116-121']],
  },
  jacket_w: {
    title: 'Куртки (Женские)',
    headers: ['Размер', 'Российский', 'Обхват груди (см)'],
    rows: [['S', '44-46', '83-88'], ['M', '46-48', '88-94'], ['L', '50', '94-100'], ['XL', '52', '100-105']],
  },
  pants_m: {
    title: 'Штаны (Мужские)',
    headers: ['Размер', 'Российский', 'Обхват талии (см)'],
    rows: [['S', '46', '76-81'], ['M', '48-50', '84-89'], ['L', '52', '91-96'], ['XL', '54', '99-104']],
  },
  pants_w: {
    title: 'Штаны (Женские)',
    headers: ['Размер', 'Российский', 'Обхват талии (см)'],
    rows: [['S', '44-46', '68-71'], ['M', '46-48', '71-76'], ['L', '50', '76-81'], ['XL', '52', '81-87']],
  },
}

export function SizeTable({ typeCode, gender = 'male' }: { typeCode: string, gender?: 'male' | 'female' }) {
  let tableData = null

  if (typeCode === 'jacket') {
    tableData = gender === 'male' ? sizeTables.jacket_m : sizeTables.jacket_w
  } else if (typeCode === 'pants') {
    tableData = gender === 'male' ? sizeTables.pants_m : sizeTables.pants_w
  } else {
    tableData = sizeTables[typeCode]
  }

  if (!tableData)
    return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ padding: '8px 12px', background: '#f4f7fb', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', borderRadius: '6px 6px 0 0', border: '1px solid var(--border)', borderBottom: 'none' }}>
        {tableData.title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid var(--border)' }}>
        <thead>
          <tr>
            {tableData.headers.map((h) => (
              <th key={h} style={{ width: `${100 / tableData!.headers.length}%`, padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: '#8a9aaa', fontWeight: 500, background: '#fff' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ width: `${100 / row.length}%`, padding: '8px 12px', borderBottom: i === tableData!.rows.length - 1 ? 'none' : '1px solid var(--border)', color: 'var(--ink)', background: '#fff' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}