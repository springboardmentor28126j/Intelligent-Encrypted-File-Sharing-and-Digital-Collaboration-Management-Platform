import { useEffect, useState } from 'react'
import api from '../services/api'
import { ActivityList } from '../components/common'
export default function Activity() { const [items, setItems] = useState([]); useEffect(() => { api.get('/activity').then(r => setItems(r.data)) }, []); return <section className="panel"><ActivityList items={items} /></section> }
