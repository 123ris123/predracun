import { useParams } from 'react-router-dom'

export default function PrintPreview(){
  const { type, id } = useParams()
  return (
    <div className="receipt">
      <h1>Predračun</h1>
      <div>Tip: {type}</div>
      <div>ID: {id}</div>
      <div className="hr"></div>
      <div className="row"><div>Stavka</div><div>Iznos</div></div>
      <div className="hr"></div>
      <div className="row"><div>Ukupno</div><div>0.00 RSD</div></div>
    </div>
  )
}
