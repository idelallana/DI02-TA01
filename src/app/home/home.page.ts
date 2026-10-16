import { Component, signal, computed, inject } from '@angular/core';
import restaurantesJSON from '../../assets/datos/restaurantes.json';
import { IonicModule, ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Restaurante } from '../interface/restaurante';
import { RestauranteService } from '../services/restaurante.service'; // ajusta la ruta a tu proyecto

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonicModule],
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {

  // ############################### REGION DATOS ###############################

  toastCtrl = inject(ToastController);
  alertCtrl = inject(AlertController);
  loadingCtrl = inject(LoadingController);
  restauranteService = inject(RestauranteService);

  // Lista completa de restaurantes leída del JSON en tiempo de compilación (solo se usa para importar a Firebase)
  restaurantes: Restaurante[] = restaurantesJSON as Restaurante[];

  // Signal principal con los restaurantes actualmente cargados (vacío hasta que el usuario pulsa "Cargar datos")
  restaurantesCargados = signal<Restaurante[]>([]);

  // true cuando hay al menos un restaurante cargado
  hayDatos = computed(() => this.restaurantesCargados().length > 0);

  // Signals para controlar el estado de las operaciones
  importando = signal(false);
  cargando = signal(false);

  // Carga los restaurantes desde Firebase y muestra un toast de confirmación
  async cargarDatos() {
    this.cargando.set(true);
    try {
      const datos = await this.restauranteService.getAll();
      this.restaurantesCargados.set(datos);
      this.mostrarToast(`${datos.length} restaurantes cargados`, 'success');
    } catch (error: any) {
      console.error(error);
      this.mostrarToast('Error al cargar los datos de Firebase', 'danger');
    } finally {
      this.cargando.set(false);
    }
  }

  // Muestra un alert de confirmación antes de borrar Firebase e importar el JSON
  async confirmarImportacion() {
    const alert = await this.alertCtrl.create({
      header: 'Importar JSON',
      message: 'Se borrarán TODOS los datos actuales de Firebase y se cargarán los del archivo JSON. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sí, Importar', role: 'confirm', handler: () => this.importarJSON() }
      ]
    });
    await alert.present();
  }

  // Borra todos los datos de Firebase y sube los del JSON local
  async importarJSON() {
    this.importando.set(true);

    const loading = await this.loadingCtrl.create({
      message: 'Borrando datos anteriores...',
      backdropDismiss: false
    });
    await loading.present();

    try {
      await this.restauranteService.deleteAll();

      loading.message = 'Subiendo restaurantes...';
      await this.restauranteService.addAll(this.restaurantes);

      this.mostrarToast(`${this.restaurantes.length} restaurantes importados correctamente`, 'success');
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'permission-denied') {
        this.mostrarToast('No tienes permisos para modificar la base de datos', 'danger');
      } else {
        this.mostrarToast('Error durante la importación', 'danger');
      }
    } finally {
      await loading.dismiss();
      this.importando.set(false);
    }
  }

  // Muestra un toast con el mensaje y color indicados
  private async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [{ text: 'X', role: 'cancel' }]
    });
    await toast.present();
  }


  // ############################### REGION FILTROS (estado general) ###############################

  textoBusqueda = signal('');

  // true si hay algún filtro activo (texto, territorio o localidades)
  hayFiltrosActivos = computed(() =>
    !!this.textoBusqueda() ||
    !!this.territorioSeleccionado() ||
    this.localidadesSeleccionadas().length > 0
  );

  // Resetea todos los filtros a sus valores iniciales
  limpiarTodosFiltros() {
    this.textoBusqueda.set('');
    this.territorioSeleccionado.set('');
    this.localidadesSeleccionadas.set([]);
  }

  // ############################### REGION TERRITORIOS ###############################

  territorioSeleccionado = signal('');

  // Lista de territorios únicos disponibles, ordenada alfabéticamente
  territoriosFiltrados = computed(() => {
    const territorios = this.restaurantesCargados().map(r => r.territory);
    return Array.from(new Set(territorios)).sort();
  });

  // Actualiza el territorio seleccionado y elimina las localidades que ya no pertenecen a él
  onTerritorioChange(value: string) {
    this.territorioSeleccionado.set(value);
    const nuevasLocalidades = this.localidadesSeleccionadas().filter(loc =>
      this.localidadesFiltradasPorTerritorio().includes(loc)
    );
    this.localidadesSeleccionadas.set(nuevasLocalidades);
  }

  // ############################### REGION LOCALIDADES ###############################

  localidadesSeleccionadas = signal<string[]>([]);

  // Lista de localidades únicas del territorio seleccionado (o de todos si no hay territorio), ordenada alfabéticamente
  localidadesFiltradasPorTerritorio = computed(() => {
    let lista = this.restaurantesCargados();
    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory?.toLowerCase().trim() === territorio);
    }
    const localities = lista.map(r => r.locality?.trim()).filter((l): l is string => !!l);
    return Array.from(new Set(localities)).sort();
  });

  // Actualiza las localidades seleccionadas con los valores del evento
  onLocalidadesChange(value: string[]) {
    this.localidadesSeleccionadas.set(value);
  }

  // ############################### REGION RESULTADOS ###############################

  // Lista filtrada de restaurantes según todos los filtros activos
  restaurantesFiltrados = computed(() => {
    let lista = this.restaurantesCargados();

    const texto = this.textoBusqueda().toLowerCase().trim();
    if (texto) {
      lista = lista.filter(r => r.documentName.toLowerCase().includes(texto));
    }

    const territorio = this.territorioSeleccionado().toLowerCase().trim();
    if (territorio) {
      lista = lista.filter(r => r.territory.toLowerCase().trim() === territorio);
    }

    const seleccionadas = this.localidadesSeleccionadas();
    if (seleccionadas.length > 0) {
      lista = lista.filter(r => seleccionadas.includes(r.locality?.trim() || ''));
    }

    return lista;
  });

  // ############################### REGION AUXILIARES ###############################

  // Devuelve el número de estrellas Michelin (0 si no tiene o el valor no es numérico)
  estrellasMichelin(r: Restaurante): number {
    return Number(r.michelinStar) || 0;
  }

  // Devuelve el número de soles Repsol (0 si no tiene o el valor no es numérico)
  repsolSoles(r: Restaurante): number {
    return Number(r.repsolSun) || 0;
  }
}