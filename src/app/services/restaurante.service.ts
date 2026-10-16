import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, writeBatch, doc } from '@angular/fire/firestore';
import { Restaurante } from '../interface/restaurante';

@Injectable({ providedIn: 'root' })
export class RestauranteService {
  private firestore = inject(Firestore);
  private coleccion = collection(this.firestore, 'restaurantesColeccion');

  // Devuelve todos los restaurantes de Firebase
  async getAll(): Promise<Restaurante[]> {
    const snap = await getDocs(this.coleccion);
    return snap.docs.map(d => d.data() as Restaurante);
  }

  // Borra todos los documentos de la colección (Firestore permite máximo 500 operaciones por batch)
  async deleteAll(): Promise<void> {
    const snap = await getDocs(this.coleccion);
    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = writeBatch(this.firestore);
      snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Añade todos los restaurantes a la colección en lotes de 500
  async addAll(restaurantes: Restaurante[]): Promise<void> {
    for (let i = 0; i < restaurantes.length; i += 500) {
      const batch = writeBatch(this.firestore);
      restaurantes.slice(i, i + 500).forEach(r => batch.set(doc(this.coleccion), { ...r }));
      await batch.commit();
    }
  }
}