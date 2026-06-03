import React from 'react'
import { useRole } from '../contexts/RoleContext'
import AdminDashboard from '../components/Dashboard/AdminDashboard'
import BakerDashboard from '../components/Dashboard/BakerDashboard'
import SalespersonDashboard from '../components/Dashboard/SalespersonDashboard'
import DriverDashboard from '../components/Dashboard/DriverDashboard'
import PartnerDashboard from '../components/Dashboard/PartnerDashboard'

export default function Dashboard() {
  const { role } = useRole()

  switch (role) {
    case 'admin':
      return <AdminDashboard />
    case 'baker':
      return <BakerDashboard />
    case 'salesperson':
      return <SalespersonDashboard />
    case 'driver':
      return <DriverDashboard />
    case 'partner':
      return <PartnerDashboard />
    default:
      return <AdminDashboard />
  }
}