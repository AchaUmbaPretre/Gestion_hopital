import React, { useState, useEffect } from 'react';
import { Input, Select, Skeleton,Popconfirm, Table, Tag, notification, Card, Space, Button, Badge, DatePicker, Dropdown, Menu, Modal, Tooltip } from 'antd';import moment from 'moment';
import 'moment/locale/fr'; // Pour utiliser le format français
import { EyeOutlined, UserOutlined,CheckOutlined,DeleteOutlined,FileExcelOutlined,FilePdfOutlined,FilterOutlined,PlusOutlined, CalendarOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getRdv, getRdvDocteur, putRdvConfirmation } from '../../../services/rdvService';
import FormRdv from '../formRdv/FormRdv';
import { useSelector } from 'react-redux';

const { Option } = Select;
const { RangePicker } = DatePicker;

const ListeRdv = () => {
  const [datas, setDatas] = useState([]);
  const [dateFilter, setDateFilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const scroll = { x: 400 };
  const role = useSelector((state) => state.user.currentUser.user.role);
  const userId = useSelector((state) => state.user.currentUser.user.id);


    const fetchData = async () => {
      try {
        if(role === 'DOCTEUR'){
          const response = await getRdvDocteur(userId)
          setDatas(response.data);
          setLoading(false);
        }
        const response = await getRdv(dateFilter);
        setDatas(response.data);
        setLoading(false);
      } catch (error) {
        notification.error({
          message: 'Erreur de chargement',
          description: 'Une erreur est survenue lors du chargement des données.',
        });
        setLoading(false);

      }
    };

  useEffect(() => {

    fetchData();
  }, [dateFilter]);

  const handleSearch = (value) => {
    setSearchTerm(value.toLowerCase());
  };

  const handleDateFilterChange = (dates) => {
    setDateFilter(dates);
  };

  // TODO(refonte RDV — étape 5.4 du MIGRATION_PLAN.md) : vue détaillée.
  // L'API expose GET /One mais la fiche détaillée RDV sera livrée avec
  // la refonte du module (DetailLayout). Stub temporaire non bloquant.
  const handleViewDetails = (id) => {
    notification.info({
      message: 'Détails du rendez-vous',
      description: `L'affichage détaillé du rendez-vous n°${id} sera disponible avec la refonte du module.`,
    });
  };

  // TODO(refonte RDV — étape 5.4 du MIGRATION_PLAN.md) : l'API backend
  // n'expose pas de route DELETE pour les RDV (routes/rdv.routes.js).
  // Suppression impossible côté client — à demander au backend ou à
  // couvrir par un statut "annulé".
  const handleDelete = (id) => {
    notification.warning({
      message: 'Suppression indisponible',
      description: `La suppression du rendez-vous n°${id} n'est pas encore prise en charge par l'API.`,
    });
  };

  const handleConfirmRdv = async (id_rdv) => {
    try {
      await putRdvConfirmation(id_rdv);
  
      notification.success({
        message: 'Confirmation réussie',
        description: 'Le rendez-vous a été confirmé avec succès.',
      });
  
      // Fetch the updated data after confirmation
      fetchData();
      window.location.reload();
    } catch (error) {
      notification.error({
        message: 'Erreur de confirmation',
        description: 'Une erreur est survenue lors de la confirmation.',
      });
    }
  };
  
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(datas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Docteurs');
    XLSX.writeFile(wb, 'docteurs_data.xlsx');
  };

  const exportToPDF = () => {
    notification.info({
      message: 'Fonctionnalité PDF',
      description: 'Exportation PDF en cours de développement.',
    });
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const filteredData = datas?.filter(item =>
    item.type_rendezvous.toLowerCase().includes(searchTerm)
  );
  
  console.log(filteredData)

  const menu = (
    <Menu>
      <Menu.Item key="1" icon={<FileExcelOutlined />} onClick={exportToExcel}>
        Exporter en Excel
      </Menu.Item>
      <Menu.Item key="2" icon={<FilePdfOutlined />} onClick={exportToPDF}>
        Exporter en PDF
      </Menu.Item>
    </Menu>
  );

  const columns = [
    { 
      title: '#', 
      dataIndex: 'id', 
      key: 'id', 
      render: (text, record, index) => index + 1 
    },
    {
      title: 'Patient',
      dataIndex: 'nom_patient',
      key: 'nom_patient',
      render: (text) => (
        <Tag color='green' icon={<UserOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Docteur',
      dataIndex: 'docteur_nom',
      key: 'docteur_nom',
      render: (text) => (
        <Tag color='green' icon={<UserOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date_rdv',
      key: 'date_rdv',
      render: (text) => (
        <Tag color='blue' icon={<CalendarOutlined />}>
          {moment(text).locale('fr').format('DD MMMM YYYY')}
        </Tag>
      ),
    },
    {
      title: 'Heure debut',
      dataIndex: 'heure_debut',
      key: 'heure_debut',
      render: (text) => (
        <Tag color='orange' icon={<ClockCircleOutlined />}>
          {moment(text, 'HH:mm').format('HH:mm')}
        </Tag>
      ),
    },
    {
      title: 'Heure fin',
      dataIndex: 'heure_fin',
      key: 'heure_fin',
      render: (text) => (
        <Tag color='orange' icon={<ClockCircleOutlined />}>
          {moment(text, 'HH:mm').format('HH:mm')}
        </Tag>
      ),
    },
    {
      title: 'Type rendezvous',
      dataIndex: 'type_rendezvous',
      key: 'type_rendezvous',
      render: (text) => (
        <Tag color='blue' icon={<FileTextOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'statut',
      key: 'statut',
      render: (text) => (
        <Tag color='blue' icon={<FileTextOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Statut de confirmation',
      dataIndex: 'confirmation_docteur',
      key: 'confirmation_docteur',
      render: (confirmation_docteur) => (
        <Tag color={confirmation_docteur === 'OUI' ? 'green' : 'red'}>
          {confirmation_docteur === 'OUI' ? 'Confirmé' : 'En attente'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <Space size="middle">
          <Tooltip title="Voir les détails">
            <Button
              icon={<EyeOutlined />}
              style={{ color: 'blue' }}
              onClick={() => handleViewDetails(record.id)}
              aria-label="Voir les détails du client"
            />
          </Tooltip>
          {role === 'DOCTEUR' && record.confirmation_docteur !== 'OUI' && (
            <Tooltip title="Confirmer le rendez-vous">
              <Popconfirm
                title="Confirmer ce rendez-vous ?"
                onConfirm={() => handleConfirmRdv(record.id_rendez_vous)}
                okText="Oui"
                cancelText="Non"
              >
                <Button icon={<CheckOutlined />} style={{ color: 'green' }} />
              </Popconfirm>
            </Tooltip>
          )}
          <Tooltip title="Supprimer">
            <Popconfirm
              title="Etes-vous sûr de vouloir supprimer ce rendez-vous ?"
              onConfirm={() => handleDelete(record.id_rdv)}
              okText="Oui"
              cancelText="Non"
            >
              <Button icon={<DeleteOutlined />} style={{ color: 'red' }} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    }
    
  ];
  

  return (
    <Card
      style={{padding:"20px 0px"}}
      title="Liste des rendez vous"
      extra={
        <Space size="middle">
          <RangePicker onChange={handleDateFilterChange} />
          <Input.Search
            placeholder="Rechercher..."
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
          <Dropdown overlay={menu} trigger={['click']}>
            <Button icon={<FilterOutlined />}>Exporter</Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
            Rendez-vous
          </Button>
        </Space>
      }
      bordered={false}
      className="listeDocteur-card"
    >
      {loading ? (
        <Skeleton active />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 10 }}
          rowKey="id_rdv"
          scroll={scroll}
          bordered
        />
      )}
      <Modal
        title=""
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={null} 
        width={700}
        centered
      >
        <FormRdv onClick={() =>setIsModalVisible(false)} fetchData={fetchData}/>
      </Modal>
    </Card>
  );
};

export default ListeRdv;
